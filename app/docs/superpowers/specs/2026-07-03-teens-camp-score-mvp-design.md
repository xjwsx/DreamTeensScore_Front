# 틴즈 캠프 팀 점수 웹앱 — MVP 구현 설계 (spec)

**작성일:** 2026-07-03
**기반 문서:** `틴즈캠프_점수웹앱_설계문서.md` (v3) 및 `app/docs/DESIGN.md`
**범위:** 로드맵 §7의 **MVP** (일부 v1 요소 포함: 즉시 취소·기록 정정)

---

## 0. 배경 / 문제

현재 코드는 설계 문서의 **골격**(기술 스택, 폴더 구조, 데이터 모델 타입, Supabase 스키마, Realtime 훅)은 충실히 따랐으나, **실제 화면·로직**은 다른 컨셉("TALLY — 게임의 밤" 가중치 심사 앱)으로 구현되어 있다. 또한 점수가 끝까지 반영되지 않는 버그가 있다:

1. `StaffScoring`이 `score_entries`에 `game_id: null`을 넣는다 → 스키마의 `game_id NOT NULL` 위반으로 제출 실패.
2. `total_score`를 갱신하는 주체(트리거/클라이언트)가 없다 → 순위판 총점이 절대 오르지 않는다.

**목표:** 기존 글래스모피즘 **비주얼(styled-components 컴포넌트)만 재사용**하고, 앱의 화면·로직·데이터 흐름을 설계 문서의 "캠프 미션 점수" 시스템으로 재구현한다.

---

## 1. 확정된 결정 사항

| 항목 | 결정 |
|------|------|
| 구현 범위 | MVP (고정 점수 부여 + 실시간 순위판 + 관리자 CRUD). 순위별(ranked) 부여는 제외 |
| 인증 | 관리자·스태프는 **ID/PW 로그인**(DB `users` 대조), 뷰어는 버튼 입장 |
| 비밀번호 저장 | **SHA-256 해시**로 저장(평문 금지). 로그인 시 클라이언트에서 해시 비교 |
| 세션 | 로그인 성공 시 **세션 토큰을 localStorage에 저장**해 새로고침해도 로그인 유지 |
| 순위 | 모든 게임 **고정 점수**(감점은 음수). 순위판은 **누적 총점으로만** 정렬 |
| 총점 갱신 | Supabase **SQL 트리거**로 `score_entries` 변경 시 `teams.total_score` 자동 재계산 |
| RLS | 개발용 전체 허용 유지. 서버단 권한 강화는 v1 (문서에 명시) |
| 비주얼 | 기존 `components/ui.tsx`·`theme`·`GlobalStyle`·`teamStyle` 재사용, 내용만 교체 |

> **보안 한계 (의도적, MVP 한정):** 서버리스(SDK 직접 연결) + 개발용 RLS 전체 허용 상태에서는 클라이언트가 `users` 행(해시 포함)을 읽을 수 있고, 세션 토큰도 클라이언트 생성이다. 이는 캠프 규모 MVP에서 수용하며, v1에서 RLS 정책·서버측 검증으로 강화한다.

---

## 2. 역할과 권한

| 역할(`role`) | 로그인 | 접근 화면 | 기능 |
|------|--------|-----------|------|
| 뷰어(그외 사용자) | 버튼 입장(비로그인) | `/scoreboard` | 순위·점수 **열람만** |
| 스태프(`staff`) | ID/PW | `/scoring` | 담당 게임 성공 팀에 **점수 부여** + 방금 준 점수 취소 |
| 관리자(`admin`) | ID/PW | `/admin` | 팀·게임 **CRUD**, 스태프 배정, 점수 기록 열람·정정 |

- `/scoreboard`는 모든 역할이 접근 가능(공개).
- `AuthContext` + 라우트 가드로 접근 제어. 권한 없는 화면 접근 시 로그인 화면 또는 순위판으로 리다이렉트.

---

## 3. 데이터 모델 변경 (schema.sql)

설계 §4 데이터 모델을 유지하되, 인증·총점 갱신을 위해 아래를 변경한다.

### 3.1 `users` 테이블 변경
- **추가:** `login_id text unique not null`, `password_hash text not null`
- **제거:** `pin_hash`
- 유지: `name`, `role`(`admin|staff`), `game_scope uuid[]`

### 3.2 총점 재계산 트리거
`score_entries`에 **insert / update / delete** 시, 영향받은 팀의 `total_score`를
`voided = false`인 기록의 `points` 합으로 재계산하는 트리거 함수 추가.

```sql
-- 개념 (실제 구현은 구현 계획에서 확정)
create or replace function recalc_team_total(p_team uuid) ...
-- score_entries after insert/update/delete → recalc_team_total(team_id)
-- update 시 team_id 변경 대비: OLD/NEW 팀 모두 재계산
```

### 3.3 샘플 시드 데이터
- 관리자 계정 1개 (예: `login_id=admin`, pw=`1234`), 스태프 계정 2~3개 (각 `game_scope` 지정).
- 비밀번호 해시는 pgcrypto `encode(digest('1234','sha256'),'hex')`로 시드(클라이언트 SHA-256과 동일 알고리즘).
- 기존 teams / games 샘플 유지(모두 `score_mode='fixed'`; 릴레이 예시는 fixed로 조정 또는 제외).

### 3.4 유지
- `games` 테이블의 `score_mode`·`rank_points` 컬럼은 데이터 모델(§4) 유지를 위해 **남겨두되**, MVP 앱은 `fixed`만 사용.

---

## 4. 프론트엔드 구조

### 4.1 신규 파일
| 파일 | 역할 |
|------|------|
| `src/context/AuthContext.tsx` | 세션 상태(role, user, token) 관리, localStorage 복원/저장, 라우트 가드용 훅 |
| `src/lib/auth.ts` | SHA-256 해시(Web Crypto), 로그인 검증, 세션 토큰 생성/저장/삭제 |
| `src/lib/api.ts` | 뮤테이션 헬퍼: `awardScore`, `voidEntry`, 게임/팀 CRUD |
| `src/hooks/useScoreEntries.ts` | 점수 기록 실시간 구독(설계 §6-2) |
| `src/hooks/useUsers.ts` | 스태프 목록(관리자 배정용) 구독 |
| `src/components/RequireRole.tsx` | 역할 기반 라우트 가드 래퍼 |

### 4.2 수정 파일
| 파일 | 변경 |
|------|------|
| `src/pages/Login.tsx` | ID/PW 로그인(관리자·스태프) + 뷰어 버튼 입장. 심사위원 문구 제거 |
| `src/pages/StaffScoring.tsx` | 가중치 채점 → **담당 게임 선택 → 성공 팀 탭 → 고정 점수 부여 + Undo** |
| `src/pages/AdminConsole.tsx` | 목업 → **팀/게임 CRUD, 스태프 배정, 기록 열람·취소** (여러 서브뷰) |
| `src/pages/Scoreboard.tsx` | 가짜 SAMPLE·"R3/5" 하드코딩 제거, 실제 총점 연결, 빈 상태 처리 |
| `src/App.tsx` | `AuthProvider` 래핑, 역할 가드 라우트 적용 |
| `src/types/index.ts` | `User`에 `loginId` 추가(pinHash 제거) |
| `src/hooks/useGames.ts` | 담당 게임 필터용 select 조정(필요 시) |

> AdminConsole이 여러 책임(팀/게임/기록)을 가지므로, 서브 컴포넌트(`TeamsPanel`, `GamesPanel`, `EntriesPanel`)로 분리해 파일이 비대해지지 않게 한다.

---

## 5. 화면별 동작

### 5.1 Login (`/login`)
- 상단: ID/PW 필드 + "로그인"(관리자·스태프 공용). 로그인 성공 시 `role`에 따라 `/admin` 또는 `/scoring`으로 이동.
- 하단: "게스트로 둘러보기" 버튼 → 뷰어 세션 → `/scoreboard`.
- 로그인 실패 시 인라인 에러 표시.

### 5.2 StaffScoring (`/scoring`) — 핵심
1. 로그인 스태프의 `gameScope`에 해당하는 게임만 조회.
2. 게임이 여럿이면 게임 선택 → 하나면 바로 진입.
3. 팀 그리드 표시. 성공한 팀 탭 → `awardScore(teamId, gameId, points)` → 트리거가 총점 갱신 → 순위판 실시간 반영.
4. 여러 팀 연속 부여 가능.
5. "방금 준 점수" 카드에 최근 부여 목록 → **취소(Undo)** = 해당 `score_entries.voided=true`.
6. `oncePerTeam=true` 게임은 이미 받은 팀 버튼 비활성화.

### 5.3 AdminConsole (`/admin`)
- **팀 패널:** 목록 + 추가(이름·색상)·수정·삭제.
- **게임 패널:** 목록 + 추가/수정/삭제(이름, `points`(음수=감점), `oncePerTeam`, 담당 스태프 `staffIds` 선택).
- **기록 패널:** 최근 `score_entries` 목록 + 개별 취소(정정). (선택) 캠프 초기화 = 전체 void.

### 5.4 Scoreboard (`/scoreboard`)
- `useTeams`로 실제 총점 조회 → 총점 내림차순 정렬 → 시상대(1·2·3위) + 4위 이하 리스트.
- 실시간 구독으로 점수 변동 시 자동 재정렬. 데이터 없으면 빈 상태 안내.

---

## 6. 실시간 동작 흐름 (설계 §6-3 충족)
1. 스태프가 성공 팀에 부여 → `score_entries` insert → **트리거가 `teams.total_score` 갱신**.
2. Supabase Realtime이 `teams` 변경 감지 → 모든 화면에 push.
3. 순위판이 `useTeams`로 자동 재정렬.

---

## 7. 범위 밖 (v1 이후)
- 순위별(ranked) 차등 부여, 별도 스태프 부여 내역 페이지.
- RLS 서버단 권한 강화, Supabase Auth/JWT 전환.
- 결과 발표 애니메이션, 통계·리포트, 다중 캠프, QR 부여.

---

## 8. 검증 기준 (완료 정의)
- `npm run typecheck` / `npm run build` 통과.
- 관리자 로그인 → 팀·게임 추가/수정/삭제 동작.
- 스태프 로그인 → 담당 게임에서 팀에 점수 부여 → 순위판 총점 즉시 증가, Undo 시 감소.
- 뷰어 버튼 입장 → 순위판만 접근, `/admin`·`/scoring` 차단.
- 새로고침 후에도 로그인 세션 유지.
