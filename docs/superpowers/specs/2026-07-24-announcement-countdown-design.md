# 브로드캐스트 알람 카운트다운 설계

날짜: 2026-07-24
관련: [2026-07-23-broadcast-alert-design.md](./2026-07-23-broadcast-alert-design.md)

## 배경

현재 브로드캐스트 알람은 `settings.announcement` 단일 행 `{ id, message }`을 admin이
덮어쓰면 접속 중인 화면에 모달이 뜨는 구조다. 방금 자동 소멸을 없애고 "확인" 버튼으로만
닫도록 바꿨다.

여기에 "프로그램 종료까지 남은 시간"을 실시간 카운트다운으로 보여주고 싶다. admin이
기한(예: 20분)을 지정하면 모든 화면이 **같은 종료 시각**을 향해 카운트다운하고, 0에
닿으면 그대로 멈춰 있다가 각자 확인을 눌러 닫는다.

## 목표

- admin이 알람에 **기한**을 붙일 수 있다(20/10/5분 또는 없음).
- 기한이 있는 알람은 모든 화면이 **동일한 남은 시간**을 실시간(1초 단위)으로 본다.
- **늦게 접속한 화면**도 기한이 미래면 정확한 남은 시간을 본다.
- 0에 닿으면 `00:00`에서 멈추고, 확인을 눌러야 닫힌다.
- 기한 없는 알람은 기존 텍스트 알람 동작(접속 중 새로 온 것만, 확인으로 닫기)을 유지한다.

## 비목표

- 서버시간 기반의 완벽한 동기화(각 기기 `Date.now()` 기준, 초 단위 오차 허용).
- 알람 이력/여러 개 동시 표시(단일 행 · 최신 교체 모델 유지).

## 데이터 모델 (스키마 마이그레이션 불필요)

`announcement` jsonb 값에 `deadline` 필드를 추가한다:

```
{ id: string, message: string, deadline: number | null }
```

- `deadline` = 종료 시각(epoch milliseconds). `null`/부재 = 카운트다운 없는 텍스트 알람.
- jsonb라 컬럼 변경이 없다. 기존 초기 행 `{"id":"","message":""}`은 `deadline` 부재 →
  `null`로 안전 처리. 008 마이그레이션은 주석만 갱신한다.

## 컴포넌트별 변경

### `src/lib/announcement.ts`
- `Announcement`에 `deadline: number | null` 추가.
- `parseAnnouncement`: `value.deadline`이 유한한 숫자면 그 값, 아니면 `null`.
- `shouldShowAnnouncement`(신규 도착 판정)는 그대로. 기한 활성 판정은 모달에서
  `deadline > now`로 계산한다.

### `src/lib/api.ts`
- `sendAnnouncement(message: string, deadline: number | null)` →
  `value = { id: newId(), message, deadline }`. 그 외(영향 행 확인·에러 처리)는 동일.

### `src/pages/Notify.tsx`
- **문구 프리셋이 기한을 함께 갖는다**: `PRESETS = [{message, min}]`
  (예: "프로그램 종료 20분 전" → 20분, "곧 시작합니다!" → null). 별도 기한 칩 줄은 두지
  않아 실수 여지를 없앤다.
- 프리셋을 탭하면 메시지가 채워지고, 선택된 프리셋(문구 일치)의 `min` 을 기한으로 쓴다.
  보낼 때 `deadline = min === null ? null : Date.now() + min*60_000`.
- 직접 입력한 커스텀 문구는 어떤 프리셋과도 안 맞으므로 카운트다운 없음(null).

### `src/components/AnnouncementModal.tsx`
- **카운트다운(deadline 있음)**:
  - 활성(`deadline > now`)이고 이 id를 이 세션에서 확인하지 않았으면 **마운트 시에도**
    모달을 띄운다(late-joiner 대응).
  - 1초 간격으로 남은 시간을 다시 계산해 `mm:ss 남음` 표시. `deadline - now <= 0`이면
    `00:00`에서 멈춤(그대로 유지).
- **확인 지속성**: 확인 시 해당 알람 `id`를 `sessionStorage`에 기록 → 새로고침해도
  다시 뜨지 않음(단, 아직 안 본 late-joiner에겐 정상 표시).
- **텍스트 알람(deadline 없음)**: 기존 동작 유지(접속 중 새로 도착한 것만, 확인으로 닫기,
  마운트 값은 "이미 본 것"으로 저장).
- 미확인 중 새 알람 도착 시 최신 것으로 교체(누적 없음)는 유지.

## 표시 형식

- 카운트다운: `mm:ss` (예: `19:47`), 라벨 "남음". 60분 넘는 기한은 다루지 않음(최대 20분).
- 메시지는 카운트다운 위에 그대로 표시. 확인 버튼은 항상 노출.

## 트레이드오프 / 리스크

- **시계 동기화**: 기한을 admin 기기의 `Date.now()`로 계산하고 각 화면도 자기 `Date.now()`로
  남은 시간을 그린다. 폰들은 보통 NTP로 초 단위까지 맞아 실사용엔 충분. 완벽한 동기화가
  필요하면 추후 서버시간(예: Postgres `now()`)으로 개선.
- **세션 지속성**: `sessionStorage`는 탭 단위. 탭을 닫았다 다시 열면 활성 기한 알람이 다시
  뜰 수 있음 — 현장 화면(키오스크)에선 오히려 바람직, 참가자 폰에서도 허용 범위.

## 테스트

- `announcement.test.ts`: `deadline` 파싱(숫자/부재/비숫자 → null) 케이스 추가, 기존
  `toEqual` 기대값에 `deadline` 반영.
- `api.test.ts`: `sendAnnouncement`가 `value.deadline`을 그대로 실어 보내는지 검증.
- 모달의 타이머/late-joiner/세션 로직은 순수 함수로 뽑을 수 있는 부분(남은 시간 포맷,
  표시 판정)을 우선 단위 테스트한다.
