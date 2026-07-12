# 팀 위치 맵 — 설계 문서

**작성일:** 2026-07-12
**대상:** 스태프·리더가 "어떤 게임에 어떤 팀이 있는지" 실시간으로 파악
**한 줄 요약:** 각 팀이 지금 머무는 게임을 스태프·리더가 수동 지정하고, 게임별 그룹 보드로 모든 기기에 실시간 표시한다.

---

## 1. 배경과 목표

캠프는 여러 게임 부스를 팀들이 순환하며 도는 방식이다. 현재 앱은 팀별 **점수**는 실시간으로 보여주지만, **각 팀이 지금 어느 게임에 있는지**는 알 수 없다. 스태프·리더가 팀의 현재 위치를 한눈에 보고, 이동 시 직접 갱신할 수 있는 화면을 추가한다.

### 확정된 결정 (브레인스토밍)

| 항목 | 결정 |
|------|------|
| 위치 결정 방식 | 스태프·리더가 **수동 지정** |
| 팀·게임 관계 | **한 팀 = 한 게임** (순환). 팀은 한 순간 오직 한 게임에만 위치 |
| 화면 표현 | **게임별 그룹 보드** (게임 카드 아래 현재 팀 칩) |
| 열람 권한 | **모두** (viewer 포함) |
| 편집 권한 | **스태프·리더** (viewer 읽기 전용) |
| 조작 방식 | 팀 칩 **탭 → 하단 게임 선택 시트** |

---

## 2. 데이터 모델

`teams` 테이블에 컬럼 하나를 추가한다. 점수(`score_entries`)와 **완전히 독립적**이며, 위치 변경은 점수에 영향을 주지 않고 초기화(soft reset)와도 무관하게 유지된다.

### 마이그레이션 `supabase/migrations/003_team_location.sql`

```sql
-- 003_team_location.sql — 팀 현재 위치(게임)
-- 적용 순서: schema.sql → 001_auth_rls.sql → 002_soft_reset_audit.sql → 003_team_location.sql
-- Supabase SQL Editor(postgres 역할)에서 실행하세요.

-- ---------- 1. 컬럼 ----------
-- current_game_id = 팀이 지금 머무는 게임. null = 대기(미배치)
alter table public.teams
  add column if not exists current_game_id uuid references public.games(id) on delete set null;

-- ---------- 2. 위치 지정 RPC (스태프도 가능하도록 SECURITY DEFINER) ----------
-- teams UPDATE 정책은 관리자 전용이므로, 스태프의 위치 변경은 이 함수로만 허용한다.
-- 함수 내부에서 역할을 검사해 admin/staff 만 통과시키고, current_game_id 한 컬럼만 바꾼다.
create or replace function public.set_team_game(p_team uuid, p_game uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.user_role() not in ('admin', 'staff') then
    raise exception '권한이 없습니다.';
  end if;
  update public.teams set current_game_id = p_game where id = p_team;
end;
$$;

revoke all on function public.set_team_game(uuid, uuid) from public;
grant execute on function public.set_team_game(uuid, uuid) to authenticated;
```

- 게임이 삭제되면(`on delete set null`) 거기 있던 팀들은 자동으로 대기 상태가 된다.
- **RLS 충돌 해결:** 현행 `teams update admin` 정책은 팀 테이블 쓰기를 관리자로 제한한다(스태프가 `total_score` 등을 임의로 못 바꾸게). 스태프의 위치 변경은 위 `set_team_game` **SECURITY DEFINER** 함수로만 우회 허용한다 — 기존 `recalc_team_total` 이 같은 이유로 SECURITY DEFINER 인 것과 동일한 패턴. 함수가 `current_game_id` 한 컬럼만 바꾸므로 스태프가 다른 컬럼을 건드릴 수 없다. `teams` 의 기존 정책은 그대로 둔다.

### 타입 변경

- `src/lib/database.types.ts` — `teams` 의 `Row`/`Insert`/`Update` 에 `current_game_id: string | null` 추가.
- `src/types/index.ts` — `Team` 에 `currentGameId: string | null` 추가.
- `src/lib/mappers.ts` — `toTeam` 에 `currentGameId: r.current_game_id` 추가.

---

## 3. 실시간

`teams` 는 이미 Supabase Realtime 에 구독되어 있고, `useTeams` 훅이 `useRealtimeList("teams", fetchTeams)` 로 변경을 받아온다. **새 구독 로직은 필요 없다** — 컬럼을 매핑하면 위치 변경이 모든 기기(맵·순위판·발표)에 자동 반영된다.

`fetchTeams` 는 `select("*")` 이므로 새 컬럼이 자동 포함된다. 쿼리 수정 불필요.

---

## 4. 쓰기 API

`src/lib/api.ts` 에 함수 하나 추가. 직접 `teams` update 대신 **`set_team_game` RPC** 를 호출한다(2절 RLS 참고). 기존 한글 에러 표준화 패턴을 따른다.

```ts
// 팀의 현재 위치(게임) 지정. null = 대기. 스태프도 가능(SECURITY DEFINER RPC).
export async function setTeamGame(teamId: string, gameId: string | null): Promise<void> {
  const { error } = await supabase.rpc("set_team_game", { p_team: teamId, p_game: gameId });
  if (error) fail("팀 위치를 바꾸지 못했습니다.", error);
}
```

- `src/lib/database.types.ts` 의 `Functions` 에 `set_team_game` 시그니처를 추가해 타입드 `.rpc()` 가 컴파일되게 한다:
  ```ts
  Functions: {
    set_team_game: { Args: { p_team: string; p_game: string | null }; Returns: undefined };
  };
  ```
- 이동 이력은 `audit_log` 에 남기지 않는다(이동이 잦고 점수처럼 되돌릴 대상이 아님 — YAGNI).

---

## 5. 화면 — `src/pages/Map.tsx`

게임별 그룹 보드. 글래스 테마(`Glass`, `ui.tsx`)와 기존 Manage/Present 레이아웃 패턴을 재사용한다.

### 구성

- **대기 카드** (맨 위): `currentGameId === null` 인 활성 팀들. 캠프 시작 시 전원 여기서 출발.
- **활성 게임마다 카드**: 헤더에 게임 이모지·이름 + 현재 팀 수 배지(예: `2팀`), 그 아래 그 게임에 있는 팀 칩들(팀 이모지·이름·색).
- 팀이 없는 게임 카드도 표시(빈 상태 문구).
- 넓은 화면(`@media (min-width: 768px)`)에서는 2열 그리드.
- 로딩 중에는 `LoadingScreen`. 활성 게임이 하나도 없으면 안내 문구.

### 데이터 조합

`useTeams()` + `useGames()` 를 함께 사용. 활성 팀(`t.active`)을 `currentGameId` 기준으로 그룹핑:
- `null` → 대기 그룹
- 그 외 → 해당 게임 그룹 (활성 게임만 카드로 노출; 비활성 게임에 남은 팀이 있으면 대기로 취급)

### 조작 (편집=스태프·리더)

- `role` 이 `admin` 또는 `staff` 일 때만 팀 칩이 탭 가능(포인터/버튼). `viewer` 는 정적 표시.
- 팀 칩 탭 → **하단 게임 선택 시트** 오픈:
  - 활성 게임 목록 + 맨 아래 **"대기(배치 안 함)"** 항목.
  - 현재 위치에 체크 표시.
  - 항목 선택 시 `setTeamGame(teamId, gameId | null)` 호출 → 시트 닫힘 → Realtime 으로 전체 갱신.
  - 실패 시 한글 에러 노출(간단한 인라인 메시지 또는 기존 `Toast` 재사용).

---

## 6. 네비게이션·권한

### 라우트 — `src/App.tsx`

`AppLayout` 하위에 추가:

```tsx
<Route path="/map" element={<RequireRole roles={["admin", "staff", "viewer"]}><MapPage /></RequireRole>} />
```

(컴포넌트 default export 이름 충돌을 피하려 import 별칭 사용: `import MapPage from "@/pages/Map";`)

### 탭바 — `src/components/TabBar.tsx`

`TABS` 배열에 5번째 항목 추가:

```ts
{ to: "/map", label: "맵", icon: MapPin, roles: ["admin", "staff", "viewer"] },
```

- 아이콘 `MapPin` (lucide-react).
- 결과 탭 수: viewer 2탭(순위·맵) / staff 4탭 / admin 5탭.
- 순서: 순위 → 맵 → 입력 → 기록 → 팀·게임 (열람용인 맵을 순위 옆에).

### 레이아웃 폭 — `src/components/AppLayout.tsx`

`WIDE_ROUTES` 에 `/map` 추가(2열 그리드 활용).

---

## 7. 테스트

기존 Vitest 패턴을 따른다.

- `src/lib/mappers.test.ts` — `toTeam` 이 `current_game_id` → `currentGameId` 를 매핑하는지 (null 및 값 케이스).
- `src/lib/api.test.ts` — `setTeamGame` 이 `set_team_game` RPC 를 올바른 인자(`p_team`, `p_game`)로 호출하고, 에러 시 한글 메시지로 throw 하는지.

---

## 8. 스코프에서 제외 (YAGNI)

- 이동 이력 `audit_log` 기록.
- Present(프로젝터) 발표 모드에 맵 추가.
- 드래그앤드롭 이동.
- 실제 공간(장소 도면) 배치도.
- 팀당 여러 게임(다대다) — 현 순환 구조에 불필요.

---

## 9. 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `supabase/migrations/003_team_location.sql` | 신규 — `current_game_id` 컬럼 + `set_team_game` RPC |
| `src/lib/database.types.ts` | `teams` Row/Insert/Update 에 컬럼 추가 + `Functions.set_team_game` |
| `src/types/index.ts` | `Team.currentGameId` 추가 |
| `src/lib/mappers.ts` | `toTeam` 매핑 추가 |
| `src/lib/api.ts` | `setTeamGame` 추가 |
| `src/pages/Map.tsx` | 신규 — 게임별 그룹 보드 |
| `src/App.tsx` | `/map` 라우트 |
| `src/components/TabBar.tsx` | "맵" 탭 |
| `src/components/AppLayout.tsx` | `/map` 를 WIDE_ROUTES 에 |
| `src/lib/mappers.test.ts` | 매퍼 테스트 |
| `src/lib/api.test.ts` | `setTeamGame` 테스트 |
