# 5단계 — 테스트 확장 설계

**작성일:** 2026-07-07
**범위:** 테스트 추가만 (앱 코드 변경 없음)

## 방침
- 핵심 플로우(순수 로직 + API 경계)를 우선 검증. 무거운 의존성(`@testing-library/react`)은 도입하지 않음 — 렌더링 테스트가 없어도 로직/매핑/API 페이로드는 커버 가능.
- 완료 기준 "핵심 플로우 테스트 20~30개" → **24개** 통과.

## 파일
- **`src/lib/mappers.test.ts`** (6) — `toTeam/toGame/toScoreEntry`의 snake_case→camelCase 매핑, null 보존(gameId/createdBy/archivedAt), 음수 점수(감점) 유지.
- **`src/lib/constants.test.ts`** (4) — `TEAM_COLORS`(8개 고유 hex), `TEAM_EMOJIS`(고유·비어있지 않음), `GAME_EMOJIS`(비어있지 않음), `SCORE_UNITS = [1,5,10,50]`.
- **`src/lib/auth.test.ts`** (2, 기존) — `emailForId` 아이디→의사 이메일 변환.
- **`src/lib/api.test.ts`** (12) — `vi.mock("@/lib/supabase")`로 클라이언트를 모킹(`makeBuilder`가 insert/update/delete 체인을 `calls`에 기록). 검증 대상:
  - `addScore` — 페이로드(부호 있는 점수·null game/createdBy), 반환 id, 실패 시 한글 에러.
  - `voidEntry` — `{voided:true}` 업데이트, 실패 시 한글 에러.
  - `resetAll` — 미보관 항목만 `archived_at` 스탬프, 반환 count, `reset` 감사 로그(actor·by 기록), 실패 시 한글 에러.
  - `setTeamActive`/`setGameActive` — `{active}` 업데이트.
  - `createTeam`/`createGame` — insert 로우.

## 수동 검증(테스트 코드 없음)
- **DB 트리거**(`recalc_team_total`) — 1·2단계에서 라이브로 확인(스태프 점수 입력 → 팀 total_score 자동 갱신, voided/archived 제외). RLS·SECURITY DEFINER 경로는 실제 Supabase 인스턴스가 필요해 단위 테스트 대상에서 제외.
- **RLS 정책** — 게스트 읽기전용·관리자/스태프 권한 분리를 브라우저로 확인.

## 회귀 검증
- 배포 전 `npm run build`(tsc --noEmit + vite build) + `npx vitest run` 통과로 기본 회귀 검증.
- 현재: 빌드 성공, 4개 파일 24개 테스트 통과.

## 도입하지 않은 것 (YAGNI)
- `@testing-library/react` 기반 컴포넌트/라우팅 테스트(`RequireRole`, Input/Manage 화면) — 완료 기준(20~30개)을 순수 로직 테스트로 충족했고, 의존성·유지비 대비 이득이 낮아 보류. 필요 시 별도 작업으로 추가.
