# 틴즈 스코어보드 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TeensDesign.html`의 아쿠아 비주얼·하단 4탭·수동 +/− 점수 구조를 채택하고, 역할별 로그인(관리자/스태프/뷰어)을 결합해 실시간 팀 스코어보드를 구현한다.

**Architecture:** React SPA + Supabase(SDK 직접). 로그인(ID/PW·SHA-256·세션 토큰)으로 역할을 판별하고 `RequireRole` 가드 + 역할별 `TabBar`로 탭 접근을 제어. 점수는 `score_entries`에 +/− 증감으로 기록하고 DB 트리거가 `teams.total_score`를 재계산, Supabase Realtime이 모든 화면을 갱신.

**Tech Stack:** React 18 · TypeScript · Vite · styled-components 6 · @supabase/supabase-js 2 · react-router-dom 6 · lucide-react · Vitest.

## Global Constraints

- `@/` → `src/` 별칭(tsconfig+vite+vitest 동일).
- DB 컬럼 snake_case ↔ 프론트 camelCase(`.select()` 별칭 매핑).
- 비밀번호 **SHA-256 hex** 저장·비교. 평문 금지.
- 테마 **청량 아쿠아 단일**: 배경 `linear-gradient(165deg,#0ea5e9 0%,#22d3ee 45%,#2dd4bf 100%)`, 폰트 **Pretendard**.
- 점수는 **수동 +/− 단위**(게임=라벨). 순위는 `total_score` 내림차순.
- 역할↔접근: 뷰어=순위·발표 / 스태프=순위·입력·기록 / 관리자=전체.
- 팀 색 팔레트: `#fb7185 #fbbf24 #a78bfa #4ade80 #38bdf8 #f472b6 #fb923c #2dd4bf`. 팀 이모지 프리셋: `🦁 🐬 🦊 🐨 🐯 🐼 🐵 🦄 🐸 🐷 🐰 🐻`. 점수 단위: `1 5 10 50` + 직접.
- 각 태스크 종료 시 `npm run typecheck` 통과가 최소 게이트. 논리 유닛은 `npm run test`도 통과.

---

## File Structure

**신규:** `src/lib/constants.ts`, `src/lib/auth.ts`(+2 테스트), `src/lib/api.ts`, `src/context/AuthContext.tsx`, `src/components/RequireRole.tsx`, `src/components/TabBar.tsx`, `src/components/AppLayout.tsx`, `src/components/TeamRankRow.tsx`, `src/hooks/useScoreEntries.ts`, `src/pages/Input.tsx`, `src/pages/Records.tsx`, `src/pages/Manage.tsx`, `src/pages/Present.tsx`, `vitest.config.ts`.

**수정:** `src/styles/theme.ts`, `src/styles/GlobalStyle.ts`, `src/components/ui.tsx`, `src/types/index.ts`, `src/hooks/useTeams.ts`, `src/hooks/useGames.ts`, `src/pages/Login.tsx`, `src/pages/Scoreboard.tsx`, `src/App.tsx`, `supabase/schema.sql`, `package.json`.

**삭제:** `src/pages/StaffScoring.tsx`, `src/pages/AdminConsole.tsx`, `src/lib/teamStyle.ts`.

---

## Task 1: Supabase 스키마 — 새 데이터 모델·트리거·시드

**Files:** Modify `supabase/schema.sql` (전체 교체).

**Interfaces:** Produces `teams(emoji,color,total_score)`, `games(emoji)`, `users(login_id,password_hash,role)`, `score_entries(game_id nullable, created_by)`, 트리거 `trg_score_entries_recalc`, 시드 `admin/1234`,`staff1/1111`.

자동 테스트 없음(로컬 DB 없음). 검증: SQL 리뷰 + Supabase SQL Editor 실행(사람).

- [ ] **Step 1: `supabase/schema.sql` 전체 교체**

```sql
-- ============================================================
-- 틴즈 스코어보드 — Supabase 스키마 (리디자인)
-- Supabase 대시보드 → SQL Editor 에 전체 복사해 실행하세요.
-- ============================================================
create extension if not exists pgcrypto;

-- ---------- 1. 테이블 ----------
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text not null default '🦁',
  color       text not null default '#38bdf8',
  total_score integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.games (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  emoji      text not null default '🎮',
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  login_id      text unique,
  password_hash text,
  role          text not null default 'staff' check (role in ('admin','staff')),
  created_at    timestamptz not null default now()
);

create table if not exists public.score_entries (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  game_id    uuid references public.games(id) on delete set null,
  points     integer not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  voided     boolean not null default false
);
create index if not exists idx_score_entries_team on public.score_entries(team_id);

-- ---------- 2. 총점 재계산 트리거 ----------
create or replace function public.recalc_team_total(p_team uuid)
returns void language sql as $$
  update public.teams t
  set total_score = coalesce((
    select sum(points) from public.score_entries
    where team_id = p_team and voided = false
  ), 0)
  where t.id = p_team;
$$;

create or replace function public.score_entries_after_change()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recalc_team_total(old.team_id);
    return old;
  end if;
  perform public.recalc_team_total(new.team_id);
  if (tg_op = 'UPDATE' and new.team_id <> old.team_id) then
    perform public.recalc_team_total(old.team_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_score_entries_recalc on public.score_entries;
create trigger trg_score_entries_recalc
after insert or update or delete on public.score_entries
for each row execute function public.score_entries_after_change();

-- ---------- 3. Realtime ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='teams') then
    alter publication supabase_realtime add table public.teams;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='games') then
    alter publication supabase_realtime add table public.games;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='score_entries') then
    alter publication supabase_realtime add table public.score_entries;
  end if;
end $$;

-- ---------- 4. RLS (개발용) ----------
alter table public.teams         enable row level security;
alter table public.games         enable row level security;
alter table public.users         enable row level security;
alter table public.score_entries enable row level security;
drop policy if exists "dev all teams"   on public.teams;
drop policy if exists "dev all games"   on public.games;
drop policy if exists "dev all users"   on public.users;
drop policy if exists "dev all entries" on public.score_entries;
create policy "dev all teams"   on public.teams         for all using (true) with check (true);
create policy "dev all games"   on public.games         for all using (true) with check (true);
create policy "dev all users"   on public.users         for all using (true) with check (true);
create policy "dev all entries" on public.score_entries for all using (true) with check (true);

-- ---------- 5. 시드 ----------
insert into public.teams (name, emoji, color) values
  ('1팀', '🦁', '#fb7185'),
  ('2팀', '🐬', '#38bdf8'),
  ('3팀', '🦊', '#fb923c'),
  ('4팀', '🐨', '#4ade80');

insert into public.games (name, emoji) values
  ('몸으로 말해요', '🎭'),
  ('릴레이 달리기', '🏃'),
  ('스피드 퀴즈', '⚡'),
  ('보물찾기', '🗺️'),
  ('장기자랑', '🎤');

insert into public.users (name, login_id, password_hash, role) values
  ('리더',   'admin',  encode(digest('1234','sha256'),'hex'), 'admin'),
  ('스태프', 'staff1', encode(digest('1111','sha256'),'hex'), 'staff');
```

- [ ] **Step 2: 리뷰 & Commit**

확인: `game_id` nullable(on delete set null), `created_by` set null, 트리거가 3연산·team 변경 처리, 시드 순서(users는 games 이후여도 무관).
```bash
git add supabase/schema.sql
git commit -m "feat(db): 리디자인 스키마(emoji·users·created_by)·트리거·시드"
```
> **적용(사람):** Supabase SQL Editor에서 실행해야 이후 화면이 동작.

---

## Task 2: 아쿠아 테마 · Pretendard · 상수

**Files:** Modify `src/styles/theme.ts`, `src/styles/GlobalStyle.ts`, `src/components/ui.tsx`; Create `src/lib/constants.ts`; Delete `src/lib/teamStyle.ts`.

**Interfaces:** Produces 새 `theme`(aqua), `TEAM_COLORS`, `TEAM_EMOJIS`, `GAME_EMOJIS`, `SCORE_UNITS`.

- [ ] **Step 1: `src/styles/theme.ts` 전체 교체**

```ts
// 청량 아쿠아 디자인 토큰
export const theme = {
  colors: {
    ink: "#0e4b63",
    text: "#ffffff",
    screenGradient: "linear-gradient(165deg,#0ea5e9 0%,#22d3ee 45%,#2dd4bf 100%)",
    sky: "#0ea5e9",
    cyan: "#22d3ee",
    teal: "#2dd4bf",
    amber: "#fbbf24",
    rose: "#fb7185",
    cta: "#0e7490", // 흰 버튼 위 텍스트
    gold: "#fbbf24",
    silver: "#cbd5e1",
    bronze: "#fb923c",
  },
  glass: {
    strong: "linear-gradient(160deg,rgba(255,255,255,.30),rgba(150,235,255,.12))",
    medium: "linear-gradient(160deg,rgba(255,255,255,.24),rgba(150,235,255,.10))",
    soft: "linear-gradient(160deg,rgba(255,255,255,.18),rgba(150,235,255,.06))",
    border: "1px solid rgba(255,255,255,.45)",
    borderSoft: "1px solid rgba(255,255,255,.3)",
    insetHi: "inset 0 1px 0 rgba(255,255,255,.5)",
  },
  radius: { sm: "14px", md: "20px", lg: "24px", pill: "999px" },
  font: {
    body: "'Pretendard',system-ui,-apple-system,sans-serif",
    display: "'Pretendard',system-ui,sans-serif",
  },
} as const;

export type AppTheme = typeof theme;
```
(`styled.d.ts`는 `AppTheme` 참조라 자동 반영. 수정 불필요.)

- [ ] **Step 2: `src/styles/GlobalStyle.ts`의 `@import` 교체**

기존 `@import url('https://fonts.googleapis.com/...Manrope...Space+Grotesk...');` 한 줄을 아래로 교체:
```ts
  @import url('https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/pretendard.min.css');
```
(나머지 GlobalStyle 내용은 그대로 — `theme.colors.ink`·`theme.font.body` 유지.)

- [ ] **Step 3: `src/components/ui.tsx`의 `WhiteButton` 기본 색 교체**

`WhiteButton`의 `color` 라인:
```ts
  color: ${({ theme, $color }) => $color ?? theme.colors.ctaPurple};
```
을 아래로 교체:
```ts
  color: ${({ theme, $color }) => $color ?? theme.colors.cta};
```

- [ ] **Step 4: `src/lib/constants.ts` 생성**

```ts
export const TEAM_COLORS = [
  "#fb7185", "#fbbf24", "#a78bfa", "#4ade80",
  "#38bdf8", "#f472b6", "#fb923c", "#2dd4bf",
];

export const TEAM_EMOJIS = ["🦁", "🐬", "🦊", "🐨", "🐯", "🐼", "🐵", "🦄", "🐸", "🐷", "🐰", "🐻"];

export const GAME_EMOJIS = ["🎭", "🏃", "⚡", "🗺️", "🎤", "🎯", "🧩", "🎲", "🎨", "🎵"];

export const SCORE_UNITS = [1, 5, 10, 50];
```

- [ ] **Step 5: `src/lib/teamStyle.ts` 삭제**

```bash
git rm src/lib/teamStyle.ts
```
(이모지 아바타로 대체되어 `teamGradient/teamInitials` 불필요. 사용처는 이후 태스크에서 재작성.)

- [ ] **Step 6: 타입 체크**

Run: `npm run typecheck`
Expected: 기존 `Scoreboard.tsx`/`StaffScoring.tsx`가 아직 `teamStyle`·`theme.colors.ctaPurple`을 참조해 **에러가 날 수 있음**. 이는 Task 6~8·12에서 해당 파일을 교체/삭제하며 해소됨. 이 태스크 커밋은 진행하되, 최종 그린은 Task 12에서 확인.

- [ ] **Step 7: Commit**

```bash
git add src/styles/theme.ts src/styles/GlobalStyle.ts src/components/ui.tsx src/lib/constants.ts
git commit -m "feat(theme): 아쿠아 토큰·Pretendard·상수, teamStyle 제거"
```

---

## Task 3: Vitest + 인증 라이브러리(`auth.ts`)

**Files:** Modify `package.json`; Create `vitest.config.ts`, `src/lib/auth.ts`, `src/lib/auth.hash.test.ts`, `src/lib/auth.session.test.ts`.

**Interfaces:** Produces `sha256Hex`, `Session{userId,name,role:'admin'|'staff'|'viewer',token}`, `saveSession/loadSession/clearSession`, `viewerSession()`, `login(loginId,pw)`, type `SessionRole`.

- [ ] **Step 1: `package.json` 스크립트·devDeps 추가 후 설치**

`scripts`에 추가:
```json
"test": "vitest run",
"test:watch": "vitest"
```
`devDependencies`에 추가:
```json
"vitest": "^2.1.1",
"jsdom": "^25.0.0"
```
Run: `npm install`

- [ ] **Step 2: `vitest.config.ts` 생성**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom", globals: true },
});
```

- [ ] **Step 3: 실패 테스트 — 해시 (`src/lib/auth.hash.test.ts`)**

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { sha256Hex } from "@/lib/auth";

describe("sha256Hex", () => {
  it("known vector for '1234'", async () => {
    expect(await sha256Hex("1234")).toBe(
      "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"
    );
  });
  it("returns 64-char lowercase hex", async () => {
    expect(await sha256Hex("hello")).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 4: 실패 테스트 — 세션 (`src/lib/auth.session.test.ts`)**

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { saveSession, loadSession, clearSession, viewerSession, type Session } from "@/lib/auth";

const sample: Session = { userId: "u1", name: "스태프", role: "staff", token: "t" };

describe("session storage", () => {
  beforeEach(() => localStorage.clear());
  it("round-trips", () => { saveSession(sample); expect(loadSession()).toEqual(sample); });
  it("null when empty", () => { expect(loadSession()).toBeNull(); });
  it("null on corrupt json", () => { localStorage.setItem("dtscore.session", "x"); expect(loadSession()).toBeNull(); });
  it("clear removes", () => { saveSession(sample); clearSession(); expect(loadSession()).toBeNull(); });
  it("viewerSession role", () => { expect(viewerSession().role).toBe("viewer"); });
});
```

- [ ] **Step 5: 실패 확인**

Run: `npm run test`
Expected: FAIL — `@/lib/auth` 없음.

- [ ] **Step 6: `src/lib/auth.ts` 구현**

```ts
import { supabase } from "@/lib/supabase";

export type SessionRole = "admin" | "staff" | "viewer";

export interface Session {
  userId: string;
  name: string;
  role: SessionRole;
  token: string;
}

const SESSION_KEY = "dtscore.session";

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function makeToken(userId: string): string {
  return `${userId}.${Date.now().toString(36)}`;
}

export function saveSession(s: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
export function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
export function viewerSession(): Session {
  return { userId: "viewer", name: "게스트", role: "viewer", token: "viewer" };
}

export async function login(loginId: string, password: string): Promise<Session> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, role, passwordHash:password_hash")
    .eq("login_id", loginId.trim())
    .maybeSingle();
  if (error) throw new Error("로그인 중 오류가 발생했습니다.");
  if (!data) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
  const row = data as unknown as { id: string; name: string; role: "admin" | "staff"; passwordHash: string | null };
  const hash = await sha256Hex(password);
  if (!row.passwordHash || hash !== row.passwordHash) {
    throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
  }
  const session: Session = { userId: row.id, name: row.name, role: row.role, token: makeToken(row.id) };
  saveSession(session);
  return session;
}
```

- [ ] **Step 7: 통과 확인 & Commit**

Run: `npm run test` → PASS(7). 그다음:
```bash
git add package.json package-lock.json vitest.config.ts src/lib/auth.ts src/lib/auth.hash.test.ts src/lib/auth.session.test.ts
git commit -m "feat(auth): SHA-256·세션·로그인 + Vitest"
```

---

## Task 4: 타입 · AuthContext · RequireRole

**Files:** Modify `src/types/index.ts`; Create `src/context/AuthContext.tsx`, `src/components/RequireRole.tsx`.

**Interfaces:**
- Produces 타입 `Team{id,name,emoji,color,totalScore}`, `Game{id,name,emoji}`, `ScoreEntry{id,teamId,gameId:string|null,points,createdBy:string|null,createdAt,voided}`, `User{id,name,loginId,role}`, `Role`.
- `AuthProvider`, `useAuth(): {session,ready,setSession,logout}`, `RequireRole({roles,children})`.

- [ ] **Step 1: `src/types/index.ts` 전체 교체**

```ts
// 데이터 모델 (리디자인)
export type Role = "admin" | "staff";

export interface Team {
  id: string;
  name: string;
  emoji: string;
  color: string;
  totalScore: number;
}

export interface Game {
  id: string;
  name: string;
  emoji: string;
}

export interface ScoreEntry {
  id: string;
  teamId: string;
  gameId: string | null;
  points: number;
  createdBy: string | null;
  createdAt: string;
  voided: boolean;
}

export interface User {
  id: string;
  name: string;
  loginId: string | null;
  role: Role;
}
```

- [ ] **Step 2: `src/context/AuthContext.tsx` 생성**

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadSession, clearSession, type Session } from "@/lib/auth";

interface AuthValue {
  session: Session | null;
  ready: boolean;
  setSession: (s: Session | null) => void;
  logout: () => void;
}

const AuthCtx = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setReady(true);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ session, ready, setSession, logout: () => { clearSession(); setSession(null); } }),
    [session, ready]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
```

- [ ] **Step 3: `src/components/RequireRole.tsx` 생성**

```tsx
import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { SessionRole } from "@/lib/auth";

export function RequireRole({ roles, children }: { roles: SessionRole[]; children: ReactNode }) {
  const { session, ready } = useAuth();
  if (!ready) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!roles.includes(session.role)) return <Navigate to="/board" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 4: 타입 체크 & Commit**

Run: `npm run typecheck` (기존 미교체 페이지 에러는 Task 12에서 해소). 신규 파일 자체는 통과.
```bash
git add src/types/index.ts src/context/AuthContext.tsx src/components/RequireRole.tsx
git commit -m "feat(auth): 타입 재정의·AuthContext·RequireRole"
```

---

## Task 5: API 헬퍼 · 훅(teams/games/scoreEntries)

**Files:** Create `src/lib/api.ts`, `src/hooks/useScoreEntries.ts`; Modify `src/hooks/useTeams.ts`, `src/hooks/useGames.ts`.

**Interfaces:**
- `addScore(teamId, gameId: string|null, points, createdBy: string|null): Promise<void>`
- `voidEntry(id): Promise<void>`, `resetAll(): Promise<void>`
- `createTeam(name, emoji, color)` / `updateTeam(id, patch: Partial<{name,emoji,color}>)` / `deleteTeam(id)`
- `createGame(name, emoji)` / `updateGame(id, patch: Partial<{name,emoji}>)` / `deleteGame(id)`
- `useTeams(): {teams, loading}` (emoji 포함), `useGames(): {games, loading}`, `useScoreEntries(limit?): {entries, loading}`

- [ ] **Step 1: `src/lib/api.ts` 생성**

```ts
import { supabase } from "@/lib/supabase";

export async function addScore(
  teamId: string, gameId: string | null, points: number, createdBy: string | null
): Promise<void> {
  const { error } = await supabase.from("score_entries").insert({
    team_id: teamId, game_id: gameId, points, created_by: createdBy, voided: false,
  });
  if (error) throw error;
}

export async function voidEntry(id: string): Promise<void> {
  const { error } = await supabase.from("score_entries").update({ voided: true }).eq("id", id);
  if (error) throw error;
}

export async function resetAll(): Promise<void> {
  const { error } = await supabase.from("score_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
}

export async function createTeam(name: string, emoji: string, color: string): Promise<void> {
  const { error } = await supabase.from("teams").insert({ name, emoji, color });
  if (error) throw error;
}
export async function updateTeam(id: string, patch: Partial<{ name: string; emoji: string; color: string }>): Promise<void> {
  const { error } = await supabase.from("teams").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw error;
}

export async function createGame(name: string, emoji: string): Promise<void> {
  const { error } = await supabase.from("games").insert({ name, emoji });
  if (error) throw error;
}
export async function updateGame(id: string, patch: Partial<{ name: string; emoji: string }>): Promise<void> {
  const { error } = await supabase.from("games").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteGame(id: string): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 2: `src/hooks/useTeams.ts` 전체 교체 (emoji 추가)**

```ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Team } from "@/types";

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("teams")
        .select("id, name, emoji, color, totalScore:total_score")
        .order("total_score", { ascending: false })
        .order("created_at", { ascending: true });
      if (active && data) setTeams(data as unknown as Team[]);
      setLoading(false);
    }
    void load();
    const channel = supabase
      .channel("teams-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, []);

  return { teams, loading };
}
```

- [ ] **Step 3: `src/hooks/useGames.ts` 전체 교체 (name·emoji)**

```ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Game } from "@/types";

export function useGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("games")
        .select("id, name, emoji")
        .order("created_at", { ascending: true });
      if (active && data) setGames(data as unknown as Game[]);
      setLoading(false);
    }
    void load();
    const channel = supabase
      .channel("games-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, []);

  return { games, loading };
}
```

- [ ] **Step 4: `src/hooks/useScoreEntries.ts` 생성**

```ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ScoreEntry } from "@/types";

export function useScoreEntries(limit = 100) {
  const [entries, setEntries] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("score_entries")
        .select("id, teamId:team_id, gameId:game_id, points, createdBy:created_by, createdAt:created_at, voided")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (active && data) setEntries(data as unknown as ScoreEntry[]);
      setLoading(false);
    }
    void load();
    const channel = supabase
      .channel("entries-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "score_entries" }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [limit]);

  return { entries, loading };
}
```

- [ ] **Step 5: 타입 체크 & Commit**

Run: `npm run typecheck` (신규/수정 파일 통과). 
```bash
git add src/lib/api.ts src/hooks/useScoreEntries.ts src/hooks/useTeams.ts src/hooks/useGames.ts
git commit -m "feat(data): api 헬퍼·scoreEntries 훅·emoji 반영 훅"
```

---

## Task 6: 공용 컴포넌트 — TeamRankRow · TabBar · AppLayout

**Files:** Create `src/components/TeamRankRow.tsx`, `src/components/TabBar.tsx`, `src/components/AppLayout.tsx`.

**Interfaces:**
- `TeamRankRow({ team, rank, maxScore, big? }: { team: Team; rank: number; maxScore: number; big?: boolean })`
- `TabBar()` — 역할별 탭, `AppLayout()` — Screen+Blob+Content(Outlet)+TabBar.

- [ ] **Step 1: `src/components/TeamRankRow.tsx` 생성**

```tsx
import styled from "styled-components";
import type { Team } from "@/types";

const Row = styled.div<{ $edge: string; $big?: boolean }>`
  position: relative;
  display: flex; align-items: center; gap: 14px;
  padding: ${({ $big }) => ($big ? "20px 20px 20px 24px" : "16px 18px 16px 22px")};
  background: ${({ theme }) => theme.glass.medium};
  border: ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  overflow: hidden;
  &::before {
    content: ""; position: absolute; left: 0; top: 12%; height: 76%; width: 6px;
    border-radius: 0 6px 6px 0; background: ${({ $edge }) => $edge};
  }
`;
const Badge = styled.div<{ $bg: string; $plain?: boolean }>`
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: ${({ theme }) => theme.font.display}; font-weight: 800; font-size: 15px;
  color: ${({ $plain }) => ($plain ? "rgba(255,255,255,.85)" : "#4a2e00")};
  background: ${({ $bg, $plain }) => ($plain ? "rgba(255,255,255,.14)" : $bg)};
`;
const Emoji = styled.div<{ $big?: boolean }>`
  width: ${({ $big }) => ($big ? 52 : 44)}px; height: ${({ $big }) => ($big ? 52 : 44)}px;
  border-radius: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  font-size: ${({ $big }) => ($big ? 28 : 24)}px;
  background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.3);
`;
const Name = styled.div<{ $big?: boolean }>`
  font-weight: 700; font-size: ${({ $big }) => ($big ? 19 : 16)}px; margin-bottom: 7px;
`;
const Bar = styled.div` height: 7px; border-radius: 4px; background: rgba(255,255,255,.2); overflow: hidden; `;
const Fill = styled.div<{ $w: number; $c: string }>`
  width: ${({ $w }) => $w}%; height: 100%; border-radius: 4px; background: ${({ $c }) => $c};
  transition: width .4s ease;
`;
const Score = styled.div<{ $big?: boolean }>`
  font-family: ${({ theme }) => theme.font.display}; font-weight: 800;
  font-size: ${({ $big }) => ($big ? 34 : 26)}px; flex-shrink: 0;
`;

const MEDAL: Record<number, string> = {
  1: "linear-gradient(150deg,#fde68a,#fbbf24)",
  2: "linear-gradient(150deg,#f1f5f9,#cbd5e1)",
  3: "linear-gradient(150deg,#fed7aa,#fb923c)",
};

export function TeamRankRow({ team, rank, maxScore, big }: { team: Team; rank: number; maxScore: number; big?: boolean }) {
  const pct = maxScore > 0 ? Math.min(100, Math.round((team.totalScore / maxScore) * 100)) : 0;
  const medal = MEDAL[rank];
  return (
    <Row $edge={team.color} $big={big}>
      <Badge $bg={medal ?? ""} $plain={!medal}>{rank}</Badge>
      <Emoji $big={big}>{team.emoji}</Emoji>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Name $big={big}>{team.name}</Name>
        <Bar><Fill $w={pct} $c={team.color} /></Bar>
      </div>
      <Score $big={big}>{team.totalScore}</Score>
    </Row>
  );
}
```

- [ ] **Step 2: `src/components/TabBar.tsx` 생성**

```tsx
import { useNavigate, useLocation } from "react-router-dom";
import styled from "styled-components";
import { Trophy, Plus, Clock, Settings } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { SessionRole } from "@/lib/auth";

const Bar = styled.div`
  margin-top: auto; display: flex; align-items: center; gap: 8px;
  background: ${({ theme }) => theme.glass.strong};
  border: ${({ theme }) => theme.glass.border};
  border-radius: 26px; padding: 10px;
`;
const Tab = styled.button<{ $on?: boolean }>`
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 4px; border-radius: 18px; font-size: 12px; font-weight: 700;
  color: ${({ $on }) => ($on ? "#0e7490" : "#fff")};
  background: ${({ $on }) => ($on ? "#fff" : "transparent")};
`;

interface TabDef { to: string; label: string; icon: typeof Trophy; roles: SessionRole[] }
const TABS: TabDef[] = [
  { to: "/board", label: "순위", icon: Trophy, roles: ["admin", "staff", "viewer"] },
  { to: "/input", label: "입력", icon: Plus, roles: ["admin", "staff"] },
  { to: "/log", label: "기록", icon: Clock, roles: ["admin", "staff"] },
  { to: "/manage", label: "팀·게임", icon: Settings, roles: ["admin"] },
];

export function TabBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { session } = useAuth();
  const role: SessionRole = session?.role ?? "viewer";
  const tabs = TABS.filter((t) => t.roles.includes(role));

  return (
    <Bar>
      {tabs.map((t) => {
        const Icon = t.icon;
        const on = pathname === t.to;
        return (
          <Tab key={t.to} $on={on} onClick={() => nav(t.to)}>
            <Icon size={20} color={on ? "#0e7490" : "#fff"} />
            {t.label}
          </Tab>
        );
      })}
    </Bar>
  );
}
```

- [ ] **Step 3: `src/components/AppLayout.tsx` 생성**

```tsx
import { Outlet } from "react-router-dom";
import { Screen, Blob, Content } from "@/components/ui";
import { TabBar } from "@/components/TabBar";

export function AppLayout() {
  return (
    <Screen>
      <Blob $size={300} $top="-60px" $left="150px" $bg="radial-gradient(circle at 40% 40%,rgba(255,255,255,.4),transparent 60%)" />
      <Blob $size={240} $top="300px" $left="-70px" $bg="radial-gradient(circle,rgba(45,212,191,.5),transparent 65%)" />
      <Content>
        <Outlet />
        <TabBar />
      </Content>
    </Screen>
  );
}
```

- [ ] **Step 4: 타입 체크 & Commit**

Run: `npm run typecheck` (신규 파일 통과).
```bash
git add src/components/TeamRankRow.tsx src/components/TabBar.tsx src/components/AppLayout.tsx
git commit -m "feat(ui): TeamRankRow·TabBar·AppLayout 공용 컴포넌트"
```

---

## Task 7: Login 화면 (아쿠아)

**Files:** Modify `src/pages/Login.tsx` (전체 교체).

**Interfaces:** Consumes `useAuth().setSession`, `login`, `viewerSession`.

- [ ] **Step 1: `src/pages/Login.tsx` 전체 교체**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Trophy, User, KeyRound, ArrowRight, Eye } from "lucide-react";
import { Screen, Blob, Content, WhiteButton, GhostButton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { login, viewerSession } from "@/lib/auth";

const Center = styled.div` flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 28px; `;
const Logo = styled.div`
  width: 88px; height: 88px; border-radius: 28px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(160deg, rgba(255,255,255,.4), rgba(255,255,255,.14));
  border: 1px solid rgba(255,255,255,.5);
  box-shadow: 0 12px 40px rgba(14,116,144,.4), inset 0 1px 0 rgba(255,255,255,.6);
`;
const Field = styled.div`
  display: flex; align-items: center; gap: 13px;
  background: ${({ theme }) => theme.glass.medium};
  border: ${({ theme }) => theme.glass.border};
  border-radius: 20px; padding: 17px 20px;
  & input { flex: 1; border: none; background: transparent; outline: none; color: #fff; font-size: 16px; }
  & input::placeholder { color: rgba(255,255,255,.65); }
`;
const Divider = styled.div`
  display: flex; align-items: center; gap: 14px; font-size: 13px; color: rgba(255,255,255,.5); padding: 4px 0;
  & span { flex: 1; height: 1px; background: rgba(255,255,255,.3); }
`;
const ErrorText = styled.div` font-size: 13px; color: #fff3b0; text-align: center; `;

export default function Login() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError(""); setBusy(true);
    try {
      const s = await login(loginId, pw);
      setSession(s);
      nav("/board", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  function enterViewer() {
    setSession(viewerSession());
    nav("/board", { replace: true });
  }

  return (
    <Screen>
      <Blob $size={340} $top="-80px" $left="-40px" $bg="radial-gradient(circle at 35% 35%,rgba(255,255,255,.7),rgba(45,212,191,.2) 60%,transparent 72%)" />
      <Blob $size={200} $top="120px" $left="200px" $bg="radial-gradient(circle,rgba(14,165,233,.5),transparent 65%)" />
      <Content>
        <Center>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Logo><Trophy size={40} color="#fff" /></Logo>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,.7)" }}>SUMMER RETREAT · TEENS</div>
              <div style={{ fontSize: 38, fontWeight: 800 }}>틴즈 스코어보드</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field>
              <User size={20} color="rgba(255,255,255,.85)" />
              <input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="아이디 (관리자·스태프)" autoCapitalize="none" />
            </Field>
            <Field>
              <KeyRound size={20} color="rgba(255,255,255,.85)" />
              <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호" type="password"
                     onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
            </Field>
            {error && <ErrorText>{error}</ErrorText>}
            <WhiteButton onClick={() => void submit()}>
              {busy ? "확인 중…" : "로그인"} <ArrowRight size={19} />
            </WhiteButton>
            <Divider><span /> 또는 <span /></Divider>
            <GhostButton onClick={enterViewer}><Eye size={18} /> 게스트로 순위 보기</GhostButton>
          </div>
        </Center>
      </Content>
    </Screen>
  );
}
```

- [ ] **Step 2: 타입 체크 & Commit**

Run: `npm run typecheck` (Login 통과).
```bash
git add src/pages/Login.tsx
git commit -m "feat(login): 아쿠아 테마 ID/PW + 게스트 입장"
```

---

## Task 8: 순위(Scoreboard) · 발표(Present)

**Files:** Modify `src/pages/Scoreboard.tsx` (전체 교체); Create `src/pages/Present.tsx`.

**Interfaces:** Consumes `useTeams`, `useAuth`, `TeamRankRow`. Scoreboard는 AppLayout Outlet 내부 콘텐츠 프래그먼트(자체 Screen 없음). Present는 자체 Screen.

- [ ] **Step 1: `src/pages/Scoreboard.tsx` 전체 교체**

```tsx
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Presentation, LogOut } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useAuth } from "@/context/AuthContext";
import { TeamRankRow } from "@/components/TeamRankRow";
import { Glass } from "@/components/ui";

const Header = styled.div` display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; `;
const Over = styled.div` font-size: 12px; font-weight: 800; letter-spacing: 2px; color: rgba(255,255,255,.7); `;
const Title = styled.div` font-size: 28px; font-weight: 800; `;
const Pill = styled.button`
  display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #0e7490;
  background: #fff; border-radius: 16px; padding: 10px 14px;
`;
const List = styled.div` display: flex; flex-direction: column; gap: 12px; `;
const Empty = styled(Glass)` padding: 32px 20px; text-align: center; color: rgba(255,255,255,.8); margin-top: 8px; `;
const Logout = styled.button`
  align-self: center; display: flex; align-items: center; gap: 6px; margin: 16px 0 4px;
  font-size: 13px; color: rgba(255,255,255,.75);
`;

export default function Scoreboard() {
  const nav = useNavigate();
  const { teams, loading } = useTeams();
  const { logout } = useAuth();
  const maxScore = teams.reduce((m, t) => Math.max(m, t.totalScore), 0);

  return (
    <>
      <Header>
        <div>
          <Over>SUMMER RETREAT · TEENS</Over>
          <Title>틴즈 스코어보드</Title>
        </div>
        <Pill onClick={() => nav("/present")}><Presentation size={16} /> 발표 모드</Pill>
      </Header>

      {teams.length === 0 ? (
        <Empty $variant="soft">{loading ? "불러오는 중…" : "아직 팀이 없어요. 팀·게임 탭에서 추가하세요."}</Empty>
      ) : (
        <List>
          {teams.map((t, i) => (
            <TeamRankRow key={t.id} team={t} rank={i + 1} maxScore={maxScore} />
          ))}
        </List>
      )}

      <Logout onClick={() => { logout(); nav("/login", { replace: true }); }}>
        <LogOut size={15} /> 로그아웃
      </Logout>
    </>
  );
}
```

- [ ] **Step 2: `src/pages/Present.tsx` 생성**

```tsx
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Trophy, X } from "lucide-react";
import { Screen, Blob, Content } from "@/components/ui";
import { useTeams } from "@/hooks/useTeams";
import { TeamRankRow } from "@/components/TeamRankRow";

const Header = styled.div` display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; `;
const Title = styled.div` display: flex; align-items: center; gap: 10px; font-size: 30px; font-weight: 800; `;
const Exit = styled.button`
  display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: #0e7490;
  background: #fff; border-radius: 16px; padding: 10px 15px;
`;
const List = styled.div` display: flex; flex-direction: column; gap: 14px; `;

export default function Present() {
  const nav = useNavigate();
  const { teams } = useTeams();
  const maxScore = teams.reduce((m, t) => Math.max(m, t.totalScore), 0);

  return (
    <Screen>
      <Blob $size={340} $top="-70px" $left="120px" $bg="radial-gradient(circle,rgba(255,255,255,.4),transparent 62%)" />
      <Blob $size={260} $top="320px" $left="-80px" $bg="radial-gradient(circle,rgba(45,212,191,.5),transparent 65%)" />
      <Content>
        <Header>
          <Title><Trophy size={30} color="#fbbf24" /> 실시간 순위</Title>
          <Exit onClick={() => nav("/board")}><X size={16} /> 나가기</Exit>
        </Header>
        <List>
          {teams.map((t, i) => (
            <TeamRankRow key={t.id} team={t} rank={i + 1} maxScore={maxScore} big />
          ))}
        </List>
      </Content>
    </Screen>
  );
}
```

- [ ] **Step 3: 타입 체크 & Commit**

Run: `npm run typecheck`.
```bash
git add src/pages/Scoreboard.tsx src/pages/Present.tsx
git commit -m "feat(board): 순위 탭·발표 모드"
```

---

## Task 9: 입력(Input) — 게임·단위 선택 + 팀별 +/−

**Files:** Create `src/pages/Input.tsx`.

**Interfaces:** Consumes `useTeams`, `useGames`, `useAuth`, `addScore`, `SCORE_UNITS`.

- [ ] **Step 1: `src/pages/Input.tsx` 생성**

```tsx
import { useState } from "react";
import styled from "styled-components";
import { Minus, Plus } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import { useAuth } from "@/context/AuthContext";
import { addScore } from "@/lib/api";
import { SCORE_UNITS } from "@/lib/constants";
import { Glass } from "@/components/ui";

const Title = styled.div` font-size: 26px; font-weight: 800; margin-bottom: 16px; `;
const Label = styled.div` font-size: 13px; font-weight: 700; color: rgba(255,255,255,.7); margin-bottom: 8px; `;
const ChipRow = styled.div` display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 16px; `;
const Chip = styled.button<{ $on?: boolean }>`
  flex-shrink: 0; padding: 10px 15px; border-radius: 16px; font-size: 14px; font-weight: 700;
  color: ${({ $on }) => ($on ? "#0e7490" : "#fff")};
  background: ${({ $on }) => ($on ? "#fff" : "rgba(255,255,255,.16)")};
  border: 1px solid rgba(255,255,255,.3);
`;
const CustomInput = styled.input`
  width: 74px; padding: 10px 12px; border-radius: 16px; font-size: 14px; font-weight: 700; text-align: center;
  color: #0e7490; background: #fff; border: none;
`;
const TeamCard = styled(Glass)` display: flex; align-items: center; gap: 14px; padding: 16px; margin-bottom: 12px; `;
const Emoji = styled.div`
  width: 46px; height: 46px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
  font-size: 26px; background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.3);
`;
const Step = styled.button<{ $bg?: string }>`
  width: 52px; height: 52px; border-radius: 16px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: ${({ $bg }) => $bg ?? "rgba(255,255,255,.18)"};
  border: 1px solid rgba(255,255,255,.3);
`;
const Empty = styled(Glass)` padding: 28px 20px; text-align: center; color: rgba(255,255,255,.8); `;

export default function Input() {
  const { teams } = useTeams();
  const { games } = useGames();
  const { session } = useAuth();
  const [gameId, setGameId] = useState<string | null>(null);
  const [unit, setUnit] = useState<number>(5);
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState("3");

  const activeGameId = gameId ?? games[0]?.id ?? null;
  const effectiveUnit = custom ? Number(customVal) || 0 : unit;
  const createdBy = session && session.role !== "viewer" ? session.userId : null;

  async function give(teamId: string, sign: 1 | -1) {
    if (effectiveUnit === 0) return;
    await addScore(teamId, activeGameId, sign * effectiveUnit, createdBy);
  }

  return (
    <>
      <Title>점수 입력</Title>

      <Label>게임 선택</Label>
      {games.length === 0 ? (
        <Empty $variant="soft" style={{ marginBottom: 16 }}>게임이 없어요. 팀·게임 탭에서 추가하세요.</Empty>
      ) : (
        <ChipRow>
          {games.map((g) => (
            <Chip key={g.id} $on={g.id === activeGameId} onClick={() => setGameId(g.id)}>{g.emoji} {g.name}</Chip>
          ))}
        </ChipRow>
      )}

      <Label>점수 단위</Label>
      <ChipRow>
        {SCORE_UNITS.map((u) => (
          <Chip key={u} $on={!custom && unit === u} onClick={() => { setCustom(false); setUnit(u); }}>+{u}</Chip>
        ))}
        <Chip $on={custom} onClick={() => setCustom(true)}>직접</Chip>
        {custom && (
          <CustomInput value={customVal} inputMode="numeric"
            onChange={(e) => setCustomVal(e.target.value.replace(/[^0-9]/g, ""))} />
        )}
      </ChipRow>

      {teams.map((t) => (
        <TeamCard key={t.id} $variant="medium">
          <Emoji>{t.emoji}</Emoji>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Pretendard',sans-serif" }}>{t.totalScore}</div>
          </div>
          <Step onClick={() => void give(t.id, -1)}><Minus size={22} color="#fff" /></Step>
          <Step $bg={t.color} onClick={() => void give(t.id, 1)}><Plus size={22} color="#fff" /></Step>
        </TeamCard>
      ))}
    </>
  );
}
```

- [ ] **Step 2: 타입 체크 & Commit**

Run: `npm run typecheck`.
```bash
git add src/pages/Input.tsx
git commit -m "feat(input): 게임·단위 선택 + 팀별 +/− 점수 부여"
```

---

## Task 10: 기록(Records) — 로그 + 취소

**Files:** Create `src/pages/Records.tsx`.

**Interfaces:** Consumes `useScoreEntries`, `useTeams`, `useGames`, `voidEntry`.

- [ ] **Step 1: `src/pages/Records.tsx` 생성**

```tsx
import styled from "styled-components";
import { Clock, Undo2 } from "lucide-react";
import { useScoreEntries } from "@/hooks/useScoreEntries";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import { voidEntry } from "@/lib/api";
import { Glass } from "@/components/ui";

const Title = styled.div` font-size: 26px; font-weight: 800; margin-bottom: 16px; `;
const Card = styled(Glass)<{ $void?: boolean }>`
  display: flex; align-items: center; gap: 12px; padding: 13px 16px; margin-bottom: 8px;
  opacity: ${({ $void }) => ($void ? 0.45 : 1)};
`;
const Delta = styled.div<{ $neg?: boolean }>`
  font-family: ${({ theme }) => theme.font.display}; font-weight: 800; font-size: 17px;
  color: ${({ $neg }) => ($neg ? "#fecaca" : "#bbf7d0")};
`;
const UndoBtn = styled.button`
  margin-left: auto; display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700;
  color: #fff; padding: 7px 11px; border-radius: 12px; background: rgba(255,255,255,.16);
`;
const Empty = styled(Glass)` padding: 40px 20px; text-align: center; `;

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Records() {
  const { entries, loading } = useScoreEntries(80);
  const { teams } = useTeams();
  const { games } = useGames();
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "팀";
  const gameName = (id: string | null) => (id ? games.find((g) => g.id === id)?.name ?? "게임" : "직접");

  return (
    <>
      <Title>점수 기록</Title>
      {entries.length === 0 ? (
        <Empty $variant="soft">
          <Clock size={30} color="rgba(255,255,255,.8)" />
          <div style={{ fontWeight: 700, marginTop: 10 }}>{loading ? "불러오는 중…" : "아직 점수 기록이 없어요"}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginTop: 4 }}>점수를 입력하면 여기에 남습니다.</div>
        </Empty>
      ) : (
        entries.map((e) => (
          <Card key={e.id} $variant="soft" $void={e.voided}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{teamName(e.teamId)}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)" }}>{gameName(e.gameId)} · {hhmm(e.createdAt)}</div>
            </div>
            <Delta $neg={e.points < 0}>{e.points >= 0 ? `+${e.points}` : e.points}</Delta>
            {e.voided ? (
              <span style={{ marginLeft: "auto", fontSize: 12.5, color: "rgba(255,255,255,.6)" }}>취소됨</span>
            ) : (
              <UndoBtn onClick={() => void voidEntry(e.id)}><Undo2 size={14} /> 취소</UndoBtn>
            )}
          </Card>
        ))
      )}
    </>
  );
}
```

- [ ] **Step 2: 타입 체크 & Commit**

Run: `npm run typecheck`.
```bash
git add src/pages/Records.tsx
git commit -m "feat(records): 점수 기록 로그 + 취소"
```

---

## Task 11: 팀·게임(Manage) — CRUD + 초기화

**Files:** Create `src/pages/Manage.tsx`.

**Interfaces:** Consumes `useTeams`, `useGames`, api CRUD·`resetAll`, `TEAM_COLORS`,`TEAM_EMOJIS`,`GAME_EMOJIS`.

- [ ] **Step 1: `src/pages/Manage.tsx` 생성**

```tsx
import { useState } from "react";
import styled from "styled-components";
import { Plus, X, RotateCcw } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import {
  createTeam, updateTeam, deleteTeam, createGame, updateGame, deleteGame, resetAll,
} from "@/lib/api";
import { TEAM_COLORS, TEAM_EMOJIS, GAME_EMOJIS } from "@/lib/constants";
import { Glass } from "@/components/ui";

const Section = styled.div` display: flex; align-items: center; justify-content: space-between; margin: 6px 0 12px; `;
const SectionTitle = styled.div` font-size: 17px; font-weight: 800; `;
const AddBtn = styled.button`
  display: flex; align-items: center; gap: 5px; padding: 9px 13px; border-radius: 14px;
  background: #fff; color: #0e7490; font-weight: 700; font-size: 13.5px;
`;
const Card = styled(Glass)` padding: 14px; margin-bottom: 10px; `;
const Row = styled.div` display: flex; align-items: center; gap: 10px; `;
const EmojiBtn = styled.button`
  width: 46px; height: 46px; border-radius: 14px; flex-shrink: 0; font-size: 24px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.35);
`;
const NameInput = styled.input`
  flex: 1; min-width: 0; border: 1px solid rgba(255,255,255,.3); border-radius: 12px;
  padding: 11px 13px; background: rgba(255,255,255,.12); color: #fff; font-size: 15px; font-weight: 600;
`;
const DelBtn = styled.button`
  width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.14);
`;
const Palette = styled.div` display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; `;
const Swatch = styled.button<{ $c: string; $on?: boolean }>`
  width: 28px; height: 28px; border-radius: 50%; background: ${({ $c }) => $c};
  border: ${({ $on }) => ($on ? "3px solid #fff" : "2px solid rgba(255,255,255,.4)")};
`;
const Reset = styled.button`
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px;
  margin: 8px 0 4px; padding: 15px; border-radius: 16px; font-size: 14px; font-weight: 700;
  color: #fff; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.3);
`;

function nextIn(list: string[], cur: string): string {
  const i = list.indexOf(cur);
  return list[(i + 1) % list.length];
}

export default function Manage() {
  const { teams } = useTeams();
  const { games } = useGames();
  const [confirmReset, setConfirmReset] = useState(false);

  async function addTeam() {
    const n = teams.length;
    await createTeam(`${n + 1}팀`, TEAM_EMOJIS[n % TEAM_EMOJIS.length], TEAM_COLORS[n % TEAM_COLORS.length]);
  }
  async function addGame() {
    await createGame("새 게임", GAME_EMOJIS[games.length % GAME_EMOJIS.length]);
  }
  async function doReset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    await resetAll();
    setConfirmReset(false);
  }

  return (
    <>
      <Section>
        <SectionTitle>👥 팀</SectionTitle>
        <AddBtn onClick={() => void addTeam()}><Plus size={15} /> 팀 추가</AddBtn>
      </Section>
      {teams.map((t) => (
        <Card key={t.id} $variant="medium">
          <Row>
            <EmojiBtn onClick={() => void updateTeam(t.id, { emoji: nextIn(TEAM_EMOJIS, t.emoji) })}>{t.emoji}</EmojiBtn>
            <NameInput defaultValue={t.name} onBlur={(e) => { if (e.target.value !== t.name) void updateTeam(t.id, { name: e.target.value }); }} />
            <DelBtn onClick={() => void deleteTeam(t.id)}><X size={18} color="#fff" /></DelBtn>
          </Row>
          <Palette>
            {TEAM_COLORS.map((c) => (
              <Swatch key={c} $c={c} $on={c === t.color} onClick={() => void updateTeam(t.id, { color: c })} />
            ))}
          </Palette>
        </Card>
      ))}

      <Section style={{ marginTop: 22 }}>
        <SectionTitle>🎮 게임</SectionTitle>
        <AddBtn onClick={() => void addGame()}><Plus size={15} /> 게임 추가</AddBtn>
      </Section>
      {games.map((g) => (
        <Card key={g.id} $variant="medium">
          <Row>
            <EmojiBtn onClick={() => void updateGame(g.id, { emoji: nextIn(GAME_EMOJIS, g.emoji) })}>{g.emoji}</EmojiBtn>
            <NameInput defaultValue={g.name} onBlur={(e) => { if (e.target.value !== g.name) void updateGame(g.id, { name: e.target.value }); }} />
            <DelBtn onClick={() => void deleteGame(g.id)}><X size={18} color="#fff" /></DelBtn>
          </Row>
        </Card>
      ))}

      <Reset onClick={() => void doReset()}>
        <RotateCcw size={16} /> {confirmReset ? "한 번 더 탭하면 전체 초기화" : "전체 점수 · 기록 초기화"}
      </Reset>
    </>
  );
}
```

- [ ] **Step 2: 타입 체크 & Commit**

Run: `npm run typecheck`.
```bash
git add src/pages/Manage.tsx
git commit -m "feat(manage): 팀·게임 CRUD + 전체 초기화"
```

---

## Task 12: 라우팅 통합 · 구버전 제거 · 최종 빌드

**Files:** Modify `src/App.tsx`; Delete `src/pages/StaffScoring.tsx`, `src/pages/AdminConsole.tsx`.

**Interfaces:** Consumes `AuthProvider`, `AppLayout`, `RequireRole`, 모든 페이지.

- [ ] **Step 1: 구버전 페이지 삭제**

```bash
git rm src/pages/StaffScoring.tsx src/pages/AdminConsole.tsx
```

- [ ] **Step 2: `src/App.tsx` 전체 교체**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { RequireRole } from "@/components/RequireRole";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Scoreboard from "@/pages/Scoreboard";
import Input from "@/pages/Input";
import Records from "@/pages/Records";
import Manage from "@/pages/Manage";
import Present from "@/pages/Present";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/board" element={<RequireRole roles={["admin", "staff", "viewer"]}><Scoreboard /></RequireRole>} />
            <Route path="/input" element={<RequireRole roles={["admin", "staff"]}><Input /></RequireRole>} />
            <Route path="/log" element={<RequireRole roles={["admin", "staff"]}><Records /></RequireRole>} />
            <Route path="/manage" element={<RequireRole roles={["admin"]}><Manage /></RequireRole>} />
          </Route>
          <Route path="/present" element={<RequireRole roles={["admin", "staff", "viewer"]}><Present /></RequireRole>} />
          <Route path="*" element={<Navigate to="/board" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: 전체 타입 체크 · 테스트 · 빌드**

Run:
```bash
npm run typecheck
npm run test
npm run build
```
Expected: 모두 PASS. (이 시점에 Task 2의 잔여 참조 에러가 모두 해소되어야 함. 에러 시 해당 파일에서 `teamStyle`·`ctaPurple`·구타입 참조를 찾아 제거.)

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(routing): AuthProvider·AppLayout·역할 가드 통합, 구버전 제거"
```

- [ ] **Step 5: 수동 검증 (사람, Supabase 연결 필요)**

`.env.local` 설정 + Task 1 SQL 적용 후 `npm run dev`:
1. `admin`/`1234` → 4탭 전부. `staff1`/`1111` → 순위·입력·기록만(팀·게임 탭 없음, `/manage` 직접 접근 시 `/board` 리다이렉트). 게스트 → 순위만.
2. 입력: 게임·단위 선택 후 +/− → 순위 총점 즉시 반영, 진행 막대·메달 갱신.
3. 기록: 부여 내역 표시·취소 시 총점 복원.
4. 팀·게임: 팀 추가/이름·색·이모지 변경/삭제, 게임 추가/삭제, 전체 초기화(두 번 탭) → 총점 0.
5. 발표 모드 전체화면·실시간. 새로고침 후 세션 유지.

---

## Self-Review

**1. Spec coverage:**
- §1 토큰: Task 2. §2 인증·역할: Task 3·4·7·12(가드·TabBar). §3 화면/라우팅: Task 6~12. §4 데이터 모델: Task 1·4. §5 파일: 신규/수정/삭제 모두 태스크에 존재. §6 동작: Task 8~11. §8 검증: Task 12 Step 3·5. — 모두 커버.

**2. Placeholder scan:** "TBD/TODO/적절히" 없음. 모든 코드 스텝에 실제 코드 포함.

**3. Type consistency:**
- `Session{userId,name,role,token}`(Task 3) — 4·7·8에서 동일 사용(gameScope 없음 확인).
- `addScore(teamId, gameId: string|null, points, createdBy: string|null)`(Task 5) — Task 9에서 `give()`가 동일 시그니처로 호출.
- `TeamRankRow({team,rank,maxScore,big})`(Task 6) — Task 8에서 동일 prop으로 사용.
- `updateTeam(id, patch)`/`updateGame(id, patch)` partial 시그니처(Task 5) — Task 11에서 `{emoji}`/`{name}`/`{color}` 부분 갱신으로 호출.
- Supabase select 별칭(`totalScore:total_score` 등) 훅 전반 일관. `Game`에 emoji 포함, `ScoreEntry.gameId` nullable 일관.
- `RequireRole` 비인가 리다이렉트 `/board`, 미로그인 `/login` — Task 4·12 일치.

**주의(실행자):** Task 2 이후 Task 12 이전까지는 구 `Scoreboard/StaffScoring/AdminConsole`이 남아 typecheck가 붉을 수 있음. 각 태스크는 신규/수정 파일 자체의 정합성만 확인하고, **최종 그린은 Task 12 Step 3**에서 확정한다. 이는 의도된 순서다.
