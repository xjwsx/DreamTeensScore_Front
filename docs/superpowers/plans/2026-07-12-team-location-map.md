# 팀 위치 맵 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 각 팀이 지금 머무는 게임을 스태프·리더가 지정하고, 게임별 그룹 보드로 모든 기기에 실시간 표시하는 "맵" 화면을 추가한다.

**Architecture:** `teams` 에 `current_game_id` 컬럼을 추가하고(점수와 독립), 스태프도 바꿀 수 있도록 `set_team_game` SECURITY DEFINER RPC 로 우회 쓰기를 연다. `teams` 는 이미 Realtime 구독 중이라 `useTeams` 훅이 위치 변경을 자동 수신한다. 새 `/map` 라우트에 게임별 그룹 보드를 그리고, 팀 칩 탭 → 하단 게임 선택 시트로 이동을 처리한다.

**Tech Stack:** React 18 + TypeScript, styled-components, Supabase(Postgres RPC + Realtime), Vitest, lucide-react.

## Global Constraints

- DB 컬럼은 snake_case, 프론트 타입(`src/types`)은 camelCase. 변환은 `src/lib/mappers.ts` 한곳에서.
- API 함수는 Supabase 세부 에러를 노출하지 않고 `fail()` 로 한글 메시지를 throw 한다(`src/lib/api.ts` 패턴).
- 읽기는 `src/lib/queries.ts`, 쓰기는 `src/lib/api.ts`.
- 테스트 환경: 순수 로직/모킹 테스트는 `// @vitest-environment node` (api.test.ts 참고), 매퍼 테스트는 기본 환경.
- 배포 전 회귀 검증: `npm run build && npm run test` 가 모두 통과해야 한다.
- 이동 이력은 `audit_log` 에 남기지 않는다(YAGNI).

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `supabase/migrations/003_team_location.sql` | 컬럼 + `set_team_game` RPC | 신규 |
| `src/lib/database.types.ts` | 수동 DB 타입 | `teams` 컬럼 + `Functions.set_team_game` |
| `src/types/index.ts` | 도메인 타입 | `Team.currentGameId` |
| `src/lib/mappers.ts` | row→도메인 매핑 | `toTeam` 에 `currentGameId` |
| `src/lib/mappers.test.ts` | 매퍼 테스트 | `currentGameId` 케이스 |
| `src/lib/api.ts` | 쓰기 API | `setTeamGame` |
| `src/lib/api.test.ts` | API 테스트 | rpc 모킹 + `setTeamGame` 케이스 |
| `src/pages/Map.tsx` | 게임별 그룹 보드 + 이동 시트 | 신규 |
| `src/App.tsx` | 라우팅 | `/map` 라우트 |
| `src/components/TabBar.tsx` | 하단 탭 | "맵" 탭 |
| `src/components/AppLayout.tsx` | 레이아웃 폭 | `/map` 를 WIDE_ROUTES 에 |

---

## Task 1: 데이터 모델 — 컬럼·RPC·타입·매퍼

DB 마이그레이션 파일과 프론트 타입 계층(타입/매퍼)을 함께 만든다. 매퍼 테스트로 마무리한다. (SQL 은 Supabase SQL Editor 에서 사람이 실행하므로 코드 테스트 대상이 아니며, 파일만 생성한다.)

**Files:**
- Create: `supabase/migrations/003_team_location.sql`
- Modify: `src/lib/database.types.ts:10-15` (teams), `:50` 부근 (Functions), 별칭 추가 불필요
- Modify: `src/types/index.ts:4-11` (Team)
- Modify: `src/lib/mappers.ts:6-8` (toTeam)
- Test: `src/lib/mappers.test.ts`

**Interfaces:**
- Produces: `Team.currentGameId: string | null`; DB 함수 `set_team_game(p_team uuid, p_game uuid)`; `Database["public"]["Functions"]["set_team_game"]` 타입.

- [ ] **Step 1: 마이그레이션 SQL 작성**

Create `supabase/migrations/003_team_location.sql`:

```sql
-- ============================================================
-- 003_team_location.sql — 3단계: 팀 현재 위치(게임)
-- 적용 순서: schema.sql → 001_auth_rls.sql → 002_soft_reset_audit.sql → 003_team_location.sql
-- Supabase 대시보드 → SQL Editor(postgres 역할)에서 실행하세요.
-- ============================================================

-- ---------- 1. 컬럼 ----------
-- current_game_id = 팀이 지금 머무는 게임. null = 대기(미배치)
alter table public.teams
  add column if not exists current_game_id uuid references public.games(id) on delete set null;

-- ---------- 2. 위치 지정 RPC ----------
-- teams UPDATE 정책은 관리자 전용이므로, 스태프의 위치 변경은 이 함수로만 허용한다.
-- 내부에서 역할을 검사해 admin/staff 만 통과시키고 current_game_id 한 컬럼만 바꾼다.
-- (recalc_team_total 이 같은 이유로 SECURITY DEFINER 인 것과 동일한 패턴)
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

- [ ] **Step 2: DB 타입에 컬럼 추가**

`src/lib/database.types.ts` 의 `teams` 블록을 교체:

```ts
      teams: {
        Row: { id: string; name: string; emoji: string; color: string; total_score: number; active: boolean; current_game_id: string | null; created_at: string };
        Insert: { id?: string; name: string; emoji?: string; color?: string; total_score?: number; active?: boolean; current_game_id?: string | null; created_at?: string };
        Update: { id?: string; name?: string; emoji?: string; color?: string; total_score?: number; active?: boolean; current_game_id?: string | null; created_at?: string };
        Relationships: [];
      };
```

- [ ] **Step 3: DB 타입에 RPC 함수 추가**

같은 파일에서 `Functions: Record<string, never>;` 를 교체:

```ts
    Functions: {
      set_team_game: { Args: { p_team: string; p_game: string | null }; Returns: undefined };
    };
```

- [ ] **Step 4: 도메인 타입에 currentGameId 추가**

`src/types/index.ts` 의 `Team` 인터페이스를 교체:

```ts
export interface Team {
  id: string;
  name: string;
  emoji: string;
  color: string;
  totalScore: number;
  active: boolean;
  currentGameId: string | null; // 팀이 지금 머무는 게임. null=대기(미배치)
}
```

- [ ] **Step 5: 매퍼에 매핑 추가**

`src/lib/mappers.ts` 의 `toTeam` 을 교체:

```ts
export function toTeam(r: TeamRow): Team {
  return { id: r.id, name: r.name, emoji: r.emoji, color: r.color, totalScore: r.total_score, active: r.active, currentGameId: r.current_game_id };
}
```

- [ ] **Step 6: 매퍼 테스트 갱신 (실패 확인용)**

`src/lib/mappers.test.ts` 의 `describe("toTeam", ...)` 블록을 교체:

```ts
describe("toTeam", () => {
  const row: TeamRow = {
    id: "t1", name: "1팀", emoji: "🦁", color: "#fb7185",
    total_score: 30, active: true, current_game_id: null, created_at: "2026-07-07T00:00:00Z",
  };
  it("maps snake_case → camelCase", () => {
    expect(toTeam(row)).toEqual({ id: "t1", name: "1팀", emoji: "🦁", color: "#fb7185", totalScore: 30, active: true, currentGameId: null });
  });
  it("carries the active flag through", () => {
    expect(toTeam({ ...row, active: false }).active).toBe(false);
  });
  it("maps current_game_id → currentGameId (배치된 팀)", () => {
    expect(toTeam({ ...row, current_game_id: "g9" }).currentGameId).toBe("g9");
  });
});
```

- [ ] **Step 7: 테스트 실행 → 통과 확인**

Run: `npm run test -- src/lib/mappers.test.ts`
Expected: PASS (toTeam 3 케이스 포함 전부 green)

- [ ] **Step 8: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음 (database.types 의 TeamRow 변경이 mappers 전체와 정합)

- [ ] **Step 9: 커밋**

```bash
git add supabase/migrations/003_team_location.sql src/lib/database.types.ts src/types/index.ts src/lib/mappers.ts src/lib/mappers.test.ts
git commit -m "feat(map): 팀 current_game_id 컬럼·RPC·타입·매퍼"
```

---

## Task 2: 쓰기 API — setTeamGame

`set_team_game` RPC 를 호출하는 API 함수와 테스트. api.test 의 supabase 모킹에 `rpc` 를 추가한다.

**Files:**
- Modify: `src/lib/api.ts` (파일 끝에 함수 추가)
- Test: `src/lib/api.test.ts`

**Interfaces:**
- Consumes: DB 함수 `set_team_game(p_team, p_game)` (Task 1).
- Produces: `setTeamGame(teamId: string, gameId: string | null): Promise<void>`.

- [ ] **Step 1: api.test 모킹에 rpc 추가 + 실패 테스트 작성**

`src/lib/api.test.ts` 를 다음 세 곳 수정한다.

(a) 상단 상태 변수 근처(9번째 줄 `insertReturn` 선언 아래)에 추가:

```ts
let rpcError: { message: string } | null = null;
```

(b) `vi.mock("@/lib/supabase", ...)` 를 교체:

```ts
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: (fn: string, args: unknown) => {
      calls[`rpc.${fn}`] = args;
      return Promise.resolve({ error: rpcError });
    },
  },
}));
```

(c) import 줄에 `setTeamGame` 추가하고, `beforeEach` 에 `rpcError = null;` 추가:

```ts
import { addScore, voidEntry, setTeamActive, setGameActive, createTeam, createGame, resetAll, setTeamGame } from "@/lib/api";

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
  insertError = null;
  updateError = null;
  rpcError = null;
  insertReturn = { id: "new-id" };
});
```

파일 끝에 테스트 블록 추가:

```ts
describe("setTeamGame", () => {
  it("calls set_team_game rpc with team and game ids", async () => {
    await setTeamGame("t1", "g1");
    expect(calls["rpc.set_team_game"]).toEqual({ p_team: "t1", p_game: "g1" });
  });
  it("passes null game for 대기(미배치)", async () => {
    await setTeamGame("t1", null);
    expect(calls["rpc.set_team_game"]).toEqual({ p_team: "t1", p_game: null });
  });
  it("throws a Korean error on failure", async () => {
    rpcError = { message: "denied" };
    await expect(setTeamGame("t1", "g1")).rejects.toThrow("팀 위치를 바꾸지 못했습니다.");
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test -- src/lib/api.test.ts`
Expected: FAIL — `setTeamGame` 이 `@/lib/api` 에 없어 import/실행 에러

- [ ] **Step 3: setTeamGame 구현**

`src/lib/api.ts` 파일 끝에 추가:

```ts
// ---------- 팀 위치(맵): 스태프도 가능하도록 SECURITY DEFINER RPC 로 우회 ----------
// gameId=null 이면 대기(미배치)로 이동.
export async function setTeamGame(teamId: string, gameId: string | null): Promise<void> {
  const { error } = await supabase.rpc("set_team_game", { p_team: teamId, p_game: gameId });
  if (error) fail("팀 위치를 바꾸지 못했습니다.", error);
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test -- src/lib/api.test.ts`
Expected: PASS (setTeamGame 3 케이스 포함 전부 green)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/api.ts src/lib/api.test.ts
git commit -m "feat(map): setTeamGame API + rpc 모킹 테스트"
```

---

## Task 3: 맵 화면 + 라우팅·탭 연결

게임별 그룹 보드 페이지를 만들고 라우트·탭·레이아웃 폭에 연결한다. 이 저장소는 컴포넌트 테스트가 없으므로(라이브러리 로직만 Vitest), 검증은 `npm run build`(tsc + vite)와 수동 브라우저 확인으로 한다.

**Files:**
- Create: `src/pages/Map.tsx`
- Modify: `src/App.tsx` (import + 라우트)
- Modify: `src/components/TabBar.tsx` (아이콘 import + TABS)
- Modify: `src/components/AppLayout.tsx:7` (WIDE_ROUTES)

**Interfaces:**
- Consumes: `useTeams()` → `{ teams: Team[] }`, `useGames()` → `{ games: Game[] }`, `useAuth()` → `{ role }`, `setTeamGame()` (Task 2), `Toast`/`useToast` (`@/components/Toast`), `Glass` (`@/components/ui`), `LoadingScreen`.
- Produces: `default` export `Map` 컴포넌트; 라우트 `/map`; 탭 "맵".

- [ ] **Step 1: Map 페이지 작성**

Create `src/pages/Map.tsx`:

```tsx
import { useState } from "react";
import styled from "styled-components";
import { Check } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import { useAuth } from "@/context/AuthContext";
import { setTeamGame } from "@/lib/api";
import { Glass } from "@/components/ui";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Toast, useToast } from "@/components/Toast";
import type { Team } from "@/types";

const Title = styled.div` font-size: 26px; font-weight: 800; margin-bottom: 4px; `;
const Sub = styled.div` font-size: 13px; color: rgba(255,255,255,.7); margin-bottom: 18px; `;
const Grid = styled.div`
  display: grid; grid-template-columns: 1fr; gap: 12px;
  @media (min-width: 768px) { grid-template-columns: repeat(2, 1fr); }
`;
const Card = styled(Glass)<{ $wait?: boolean }>`
  padding: 15px 16px;
  ${({ $wait }) => $wait && "grid-column: 1 / -1;"}
`;
const Head = styled.div` display: flex; align-items: center; gap: 9px; margin-bottom: 12px; `;
const HeadEmoji = styled.span` font-size: 22px; `;
const HeadName = styled.div` font-size: 16px; font-weight: 800; `;
const Count = styled.div`
  margin-left: auto; font-size: 12px; font-weight: 800; color: #0e7490;
  background: #fff; border-radius: 12px; padding: 4px 9px;
`;
const Chips = styled.div` display: flex; flex-wrap: wrap; gap: 8px; `;
const Chip = styled.button<{ $bg: string; $static?: boolean }>`
  display: flex; align-items: center; gap: 7px; padding: 9px 13px; border-radius: 999px;
  font-size: 14px; font-weight: 700; color: #fff;
  background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28);
  cursor: ${({ $static }) => ($static ? "default" : "pointer")};
  transition: transform .12s ease;
  &:active { transform: ${({ $static }) => ($static ? "none" : "scale(.95)")}; }
  & span.dot { width: 10px; height: 10px; border-radius: 50%; background: ${({ $bg }) => $bg}; }
`;
const EmptyChips = styled.div` font-size: 13px; color: rgba(255,255,255,.55); `;

/* 하단 게임 선택 시트 */
const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 130; background: rgba(0,0,0,.45);
  display: flex; align-items: flex-end; justify-content: center;
`;
const Sheet = styled.div`
  width: 100%; max-width: 480px; max-height: 72dvh; overflow-y: auto;
  background: ${({ theme }) => theme.colors.screenGradient};
  border-radius: 24px 24px 0 0; padding: 18px 18px 28px;
  border-top: 1px solid rgba(255,255,255,.3);
`;
const SheetTitle = styled.div` font-size: 15px; font-weight: 800; margin-bottom: 14px; `;
const Item = styled.button<{ $on?: boolean }>`
  width: 100%; display: flex; align-items: center; gap: 10px; text-align: left;
  padding: 14px 15px; border-radius: 16px; margin-bottom: 8px;
  font-size: 15px; font-weight: 700; color: ${({ $on }) => ($on ? "#0e7490" : "#fff")};
  background: ${({ $on }) => ($on ? "#fff" : "rgba(255,255,255,.12)")};
  border: 1px solid rgba(255,255,255,.24);
  & .ck { margin-left: auto; }
`;

export default function Map() {
  const { teams, loading: tLoading } = useTeams();
  const { games, loading: gLoading } = useGames();
  const { role } = useAuth();
  const { toast, notify } = useToast();
  const [sheetTeam, setSheetTeam] = useState<Team | null>(null);

  if (tLoading || gLoading) return <LoadingScreen />;

  const canEdit = role === "admin" || role === "staff";
  const activeTeams = teams.filter((t) => t.active);
  const activeGames = games.filter((g) => g.active);
  const activeGameIds = new Set(activeGames.map((g) => g.id));
  // 대기: 위치 없음 또는 비활성 게임을 가리키는 팀
  const waiting = activeTeams.filter((t) => !t.currentGameId || !activeGameIds.has(t.currentGameId));

  async function move(team: Team, gameId: string | null) {
    setSheetTeam(null);
    try {
      await setTeamGame(team.id, gameId);
      const dest = gameId ? games.find((g) => g.id === gameId)?.name ?? "게임" : "대기";
      notify(`${team.name} → ${dest}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "위치를 바꾸지 못했습니다.", true);
    }
  }

  const renderChip = (t: Team) => (
    <Chip
      key={t.id}
      $bg={t.color}
      $static={!canEdit}
      as={canEdit ? "button" : "div"}
      onClick={canEdit ? () => setSheetTeam(t) : undefined}
    >
      <span className="dot" />
      {t.emoji} {t.name}
    </Chip>
  );

  return (
    <>
      <Toast toast={toast} />
      <Title>맵</Title>
      <Sub>{canEdit ? "팀을 눌러 게임으로 이동하세요" : "각 게임에 있는 팀"}</Sub>

      <Grid>
        <Card $wait>
          <Head>
            <HeadEmoji>⏳</HeadEmoji>
            <HeadName>대기</HeadName>
            <Count>{waiting.length}팀</Count>
          </Head>
          {waiting.length ? <Chips>{waiting.map(renderChip)}</Chips> : <EmptyChips>대기 중인 팀 없음</EmptyChips>}
        </Card>

        {activeGames.map((g) => {
          const here = activeTeams.filter((t) => t.currentGameId === g.id);
          return (
            <Card key={g.id}>
              <Head>
                <HeadEmoji>{g.emoji}</HeadEmoji>
                <HeadName>{g.name}</HeadName>
                <Count>{here.length}팀</Count>
              </Head>
              {here.length ? <Chips>{here.map(renderChip)}</Chips> : <EmptyChips>아직 없음</EmptyChips>}
            </Card>
          );
        })}
      </Grid>

      {sheetTeam && (
        <Overlay onClick={() => setSheetTeam(null)}>
          <Sheet onClick={(e) => e.stopPropagation()}>
            <SheetTitle>{sheetTeam.emoji} {sheetTeam.name} 을(를) 어디로?</SheetTitle>
            {activeGames.map((g) => (
              <Item key={g.id} $on={sheetTeam.currentGameId === g.id} onClick={() => move(sheetTeam, g.id)}>
                <span>{g.emoji}</span> {g.name}
                {sheetTeam.currentGameId === g.id && <Check className="ck" size={18} />}
              </Item>
            ))}
            <Item $on={!sheetTeam.currentGameId} onClick={() => move(sheetTeam, null)}>
              <span>⏳</span> 대기(배치 안 함)
              {!sheetTeam.currentGameId && <Check className="ck" size={18} />}
            </Item>
          </Sheet>
        </Overlay>
      )}
    </>
  );
}
```

- [ ] **Step 2: 라우트 추가**

`src/App.tsx` 에서 (a) import 추가:

```tsx
import MapPage from "@/pages/Map";
```

(b) `AppLayout` 하위 라우트 그룹(현재 `/manage` 라우트 아래)에 추가:

```tsx
            <Route path="/map" element={<RequireRole roles={["admin", "staff", "viewer"]}><MapPage /></RequireRole>} />
```

- [ ] **Step 3: 탭 추가**

`src/components/TabBar.tsx` 에서 (a) 아이콘 import 에 `MapPin` 추가:

```tsx
import { Trophy, Plus, Clock, Settings, MapPin } from "lucide-react";
```

(b) `TABS` 배열에서 `/board` 다음(입력 앞)에 추가:

```ts
  { to: "/board", label: "순위", icon: Trophy, roles: ["admin", "staff", "viewer"] },
  { to: "/map", label: "맵", icon: MapPin, roles: ["admin", "staff", "viewer"] },
  { to: "/input", label: "입력", icon: Plus, roles: ["admin", "staff"] },
```

- [ ] **Step 4: 레이아웃 폭 넓히기**

`src/components/AppLayout.tsx:7` 의 `WIDE_ROUTES` 를 교체:

```ts
const WIDE_ROUTES = ["/input", "/log", "/manage", "/map"];
```

- [ ] **Step 5: 타입체크 + 빌드 + 전체 테스트**

Run: `npm run build`
Expected: `tsc --noEmit` 통과 후 vite 빌드 성공(에러 0)

Run: `npm run test`
Expected: 전체 스위트 PASS

- [ ] **Step 6: 수동 확인 (브라우저)**

Run: `npm run dev` 후 `http://localhost:5173/map`
확인:
1. 스태프/리더 로그인 → 팀 칩 탭 → 시트에서 게임 선택 → 칩이 해당 게임 카드로 이동, 상단 토스트 노출.
2. 다른 탭(순위)이나 새 창을 열어둔 채 이동 → Realtime 으로 즉시 반영.
3. viewer(비로그인)로 `/map` → 칩 탭 불가(정적), 탭바에 순위·맵 2개만.
4. "대기(배치 안 함)" 선택 → 팀이 대기 카드로 복귀.

> DB 선행: 이 단계 전에 `supabase/migrations/003_team_location.sql` 을 Supabase SQL Editor 에서 실행해야 실제 이동이 저장된다.

- [ ] **Step 7: 커밋**

```bash
git add src/pages/Map.tsx src/App.tsx src/components/TabBar.tsx src/components/AppLayout.tsx
git commit -m "feat(map): 게임별 그룹 보드 화면 + 라우트·탭 연결"
```

---

## 완료 기준

- [ ] `supabase/migrations/003_team_location.sql` 작성(그리고 Supabase 에서 실행).
- [ ] `npm run build` 통과 (tsc + vite).
- [ ] `npm run test` 통과 (mappers·api 신규 케이스 포함).
- [ ] `/map` 에서 스태프·리더가 팀을 이동하고 모든 기기에 실시간 반영됨.
- [ ] viewer 는 열람만 가능.
