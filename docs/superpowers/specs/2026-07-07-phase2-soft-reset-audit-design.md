# 2단계 — 데이터 삭제/초기화 안전화 설계

**작성일:** 2026-07-07
**결정:** 초기화 = `archived_at` soft reset / 팀·게임 제거 = 비활성화 우선

## 목표
초기화·삭제로 데이터가 영구 소실되지 않게 하고, 변경 이력을 추적한다.

## 데이터 모델 (`002_soft_reset_audit.sql`)
- `score_entries.archived_at timestamptz` — 초기화 시 보관(총점 제외, 보존).
- `teams.active`, `games.active boolean default true` — 비활성화(숨김, 기록 보존).
- `recalc_team_total` → `voided=false AND archived_at is null` 합계.
- `score_entries.team_id`·`game_id` FK를 **`on delete restrict`** — 기록 있는 팀/게임 DB단 삭제 차단.
- `audit_log(action, actor, detail jsonb, created_at)` + RLS(insert staff/admin, select admin).

## 동작
- **초기화** `resetAll(actorId, name)` — 활성 기록에 `archived_at=now()` 일괄 + audit('reset', by, count). 반환 count.
- **되돌리기** `restoreLastReset(actorId)` — 가장 최근 archived 배치를 `archived_at=null` 복구 + audit('reset_undo').
- **비활성화** `setTeamActive`/`setGameActive` — active 토글 + audit.
- **삭제** — 기록 있으면 FK(restrict)로 실패 → UI가 "비활성화하세요" 안내. 기록 없으면 두 번 탭 확인 후 삭제 + audit.
- 화면: 순위·발표·입력은 `active` 팀/게임만 표시. 기록 탭은 archived 기록을 "보관됨"으로 표시.
- 관리 화면: 활성 토글, 삭제 게이트, 초기화 개수 표시 + 되돌리기, "마지막 초기화: 시각 · 이름"(audit) 표시.

## 완료 기준 충족
- 실수 초기화 복구 가능(archived 보존 + 되돌리기).
- 점수 이력 추적 가능(archived 기록 보존·표시, audit_log).
- 팀·게임 삭제로 과거 기록 안 사라짐(비활성화 + FK restrict).

## 적용 순서
schema.sql → 001_auth_rls.sql → **002_soft_reset_audit.sql**
