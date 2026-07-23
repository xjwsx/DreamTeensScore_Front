# 브로드캐스트 알람(관리자 모달 알림) 설계

- 날짜: 2026-07-23
- 상태: 승인됨 (구현 대기)

## 배경 / 목적

이벤트 진행 중 admin 계정이 나머지 모든 계정(staff·게스트·발표 모드)의 화면에
"30분 남았습니다!" 같은 안내 모달을 즉시 띄우고 싶다. 모달은 3.5초 뒤 자동으로
사라지는 **일시적(live) 알람**이다.

## 요구사항 (확정)

- 메시지 입력: **자유 입력 + 프리셋 버튼** 병행.
- 수신 대상: **모든 계정**(staff·viewer/게스트) + **발표 모드(/present)**.
- 표시 방식: 모달을 띄우고 **약 3.5초 후 자동으로 닫힘**(탭하면 즉시 닫힘).
- 새로고침하거나 뒤늦게 접속한 사람에게는 **표시하지 않음**(지나간 알람은 안 뜸).
- 보내기는 **admin 전용 새 탭**에서 수행.

## 접근 방식

기존 `settings` 키-값 테이블 + `useRealtimeList` 실시간 구독 패턴을 재사용한다
(선례: `hide_scores`). `settings`에 `announcement` 행 하나를 두고 admin이 보낼
때마다 새 `id`를 쓴다. 클라이언트는 실시간 변경을 받아 **화면에 붙어 있는 동안
새로 도착한 `id`만** 모달로 띄운다.

핵심: **마운트 시점의 현재 `id`는 "이미 본 것"으로 간주**해 저장만 하고 띄우지
않는다. 이후 `id`가 바뀔 때만 표시한다. 이렇게 하면:

- 지금 접속해 있는 사람은 admin 전송 즉시 모달을 본다.
- 새로고침·뒤늦은 접속자는 마운트 때 값을 "이미 본 것"으로 저장하므로 지나간
  알람이 뜨지 않는다 — 타임스탬프/시계 동기화 로직 불필요.

대안으로 검토했으나 채택하지 않음:
- **Realtime broadcast 채널**: DB를 안 쓰지만 이 앱에 없는 새 메커니즘이고
  "누가 보낼 수 있나"에 대한 RLS 보호가 약함.
- **타임스탬프 신선도 창**: 로드 시에도 N초 내면 표시. 자동소멸 요구엔 과하고
  클라이언트 간 시계 오차 문제가 있음.

## 데이터 모델

마이그레이션 `008_settings_announcement.sql`:

- `settings`에 `announcement` 행 추가.
  - `value` jsonb = `{ "id": "", "message": "" }` (초기값, 빈 상태).
- RLS는 기존 `settings` 정책을 그대로 적용받는다: 읽기 공개 / admin만 update.
  앱은 행을 만들지 않고 **update만** 한다(마이그레이션이 행을 생성).
- Realtime publication에는 이미 `settings` 테이블이 포함되어 있어 추가 작업 없음.

## 컴포넌트 / 변경 파일

### 보내기

- `src/lib/api.ts` — `sendAnnouncement(message: string): Promise<void>`
  - `settings` 행 `key='announcement'`을 `{ id: crypto.randomUUID(), message }`로
    update. 기존 `setHideScores`처럼 `.select("key")`로 영향 행을 확인해
    마이그레이션 미적용(행 없음)을 조용히 넘기지 않고 에러로 알린다.

### 새 탭 (admin 전용)

- `src/components/TabBar.tsx` — TABS에
  `{ to: "/notify", label: "알림", icon: BellRing, roles: ["admin"] }` 추가.
  (admin 탭이 6개가 됨 — 모바일에서 다소 빡빡하나 수용.)
- `src/App.tsx` — 라우트 추가:
  `/notify` → `RequireRole roles={["admin"]}` 안에 `Notify` 페이지.
- `src/pages/Notify.tsx` (신규)
  - 프리셋 버튼: `30분 남았습니다!`, `10분 남았습니다!`, `5분 남았습니다!`,
    `곧 시작합니다!`.
  - 자유 입력 칸 + "보내기" 버튼.
  - 프리셋 탭 → 입력칸에 문구 채움. 보내기 → `sendAnnouncement(message)`.
  - 빈 메시지면 보내기 비활성화. 전송 성공 시 Toast 등으로 피드백(기존 패턴).

### 받기 (모두 + 게스트 + 발표모드)

- `src/hooks/useSettings.ts` — `announcement: { id: string; message: string } | null`도
  반환하도록 확장. `settings` 행에서 `key === 'announcement'`의 value를 파싱.
- `src/components/AnnouncementModal.tsx` (신규)
  - `useSettings()`의 `announcement`를 구독.
  - `lastShownId` ref로 추적: **마운트 시 현재 id를 저장(안 띄움)**, 이후 id가
    바뀌고 message가 비어있지 않으면 모달 표시 + 3.5초 타이머로 자동 닫힘.
    탭(백드롭/카드 클릭)하면 즉시 닫힘. 타이머는 언마운트/재표시 시 정리.
  - 아쿠아 카드 스타일(`ConfirmModal` 톤) 재사용, 버튼 없이 메시지만 표시.
- 마운트 위치:
  - `src/components/AppLayout.tsx` — 순위·맵·입력·기록·관리 전체 커버.
  - `src/pages/Present.tsx` — 발표 모드.
  - 두 화면은 동시에 렌더되지 않으므로 중복 표시 없음.

## 표시 로직 (순수 헬퍼)

id 변경 감지를 순수 함수로 분리해 테스트한다:

```
shouldShowAnnouncement(prevId: string | null, next: { id, message }): boolean
  = next.message !== "" && next.id !== "" && next.id !== prevId
```

`AnnouncementModal`은 이 헬퍼와 `lastShownId` ref로 표시 여부를 판단하고,
표시 후 `lastShownId`를 갱신한다.

## 엣지 케이스

- 빈 메시지: 보내기 버튼 비활성화(전송 자체 차단).
- 연속 전송: 각 전송이 새 id를 가지므로 순차적으로 표시된다. 표시 중 새 알람이
  오면 타이머를 리셋하고 새 메시지로 교체한다.
- 마이그레이션 미적용: `sendAnnouncement`가 `.select()` 결과 0행이면 에러로 알림.
- 새로고침/뒤늦은 접속: 마운트 시 현재 id를 "이미 본 것"으로 저장 → 안 뜸.

## 테스트

- `sendAnnouncement`: update 호출 형태/에러 처리(기존 api 테스트 패턴).
- `useSettings`: `announcement` 파싱(행 없음 → null, 정상 파싱).
- `shouldShowAnnouncement` 순수 헬퍼: 초기(prev=null)·동일 id·새 id·빈 메시지 케이스.

## 범위 밖 (YAGNI)

- 알람 이력/로그 보관, 수신 확인, 대상별 필터링(특정 계정만), 예약 전송,
  admin이 "해제"하는 버튼 — 자동소멸 + 일시적 모델이라 불필요.
