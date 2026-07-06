# 틴즈 캠프 팀 점수 웹앱 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 글래스모피즘 비주얼을 재사용해, 앱을 설계 문서의 "캠프 미션 점수" 시스템(ID/PW 로그인·역할별 권한·고정 점수 부여·실시간 순위판·관리자 CRUD)으로 재구현한다.

**Architecture:** React SPA + Supabase(SDK 직접 연결, 서버리스). 인증은 `users` 테이블 ID/PW 대조 후 세션 토큰을 localStorage에 저장. 점수는 `score_entries`에 기록하고 DB 트리거가 `teams.total_score`를 자동 재계산하며, Supabase Realtime이 모든 화면을 갱신한다.

**Tech Stack:** React 18 · TypeScript · Vite · styled-components 6 · @supabase/supabase-js 2 · react-router-dom 6 · lucide-react · Vitest(신규).

## Global Constraints

- `@/` 는 `src/` 로 매핑되는 import 별칭 (tsconfig + vite + vitest 모두 동일).
- DB 컬럼은 snake_case, 프론트 타입은 camelCase. Supabase `.select()`에서 `camel:snake` 별칭으로 매핑.
- 비밀번호는 **SHA-256 hex**로 저장·비교. 평문 저장·비교 금지.
- 모든 게임은 **fixed 점수**(감점은 음수). 순위별(ranked) 부여 없음. 순위판은 `total_score` 내림차순으로만 정렬.
- 스태프의 담당 게임 판별은 **`games.staff_ids` 배열에 해당 스태프 `user.id` 포함 여부**를 단일 기준으로 한다.
- 기존 `src/components/ui.tsx`, `src/styles/theme.ts`, `src/styles/GlobalStyle.ts`, `src/lib/teamStyle.ts` 를 그대로 재사용한다(내용만 교체, 스타일 토큰 유지).
- 각 작업 종료 시 `npm run typecheck` 통과가 최소 게이트. 논리 유닛은 `npm run test` 도 통과해야 한다.

---

## File Structure

**신규:**
- `vitest.config.ts` — Vitest 설정(@ 별칭, jsdom)
- `src/lib/auth.ts` — SHA-256 해시, 세션 저장/복원, 로그인 검증
- `src/lib/auth.hash.test.ts` — 해시 단위 테스트(node 환경)
- `src/lib/auth.session.test.ts` — 세션 저장/복원 테스트(jsdom 환경)
- `src/lib/api.ts` — 뮤테이션 헬퍼(점수 부여/취소, 팀·게임 CRUD)
- `src/context/AuthContext.tsx` — 세션 컨텍스트/훅
- `src/components/RequireRole.tsx` — 역할 라우트 가드
- `src/hooks/useScoreEntries.ts` — 점수 기록 실시간 구독
- `src/hooks/useUsers.ts` — 사용자(스태프) 목록 구독
- `src/components/admin/TeamsPanel.tsx` — 팀 CRUD
- `src/components/admin/GamesPanel.tsx` — 게임 CRUD + 스태프 배정
- `src/components/admin/EntriesPanel.tsx` — 점수 기록 열람·취소

**수정:**
- `supabase/schema.sql` — users 컬럼 변경 + 총점 트리거 + 시드
- `src/types/index.ts` — `User.loginId` 추가
- `src/App.tsx` — AuthProvider + 역할 가드 라우트
- `src/pages/Login.tsx` — ID/PW + 게스트
- `src/pages/Scoreboard.tsx` — 실제 총점 연결, 하드코딩 제거, 역할별 네비
- `src/pages/StaffScoring.tsx` — 담당 게임 → 성공 팀 부여 + Undo
- `src/pages/AdminConsole.tsx` — 목업 → 3패널 CRUD
- `package.json` — vitest/jsdom devDeps + test 스크립트

---

## Task 1: Supabase 스키마 — users 인증 컬럼 · 총점 트리거 · 시드

**Files:**
- Modify: `supabase/schema.sql` (전체 교체)

**Interfaces:**
- Produces: `public.users(login_id, password_hash, role, game_scope)`, `public.recalc_team_total(uuid)`, 트리거 `trg_score_entries_recalc`. 시드 계정 `admin/1234`, `staff1/1111`, `staff2/2222`.

이 작업은 자동 테스트 대상이 아니다(로컬 DB 없음). 검증은 (a) SQL 자체 일관성 리뷰, (b) Supabase SQL Editor에 붙여넣어 오류 없이 실행됨을 사람이 확인.

- [ ] **Step 1: `supabase/schema.sql` 전체를 아래 내용으로 교체**

```sql
-- ============================================================
-- 틴즈 캠프 팀 점수 웹앱 — Supabase 스키마 (MVP)
-- Supabase 대시보드 → SQL Editor 에 전체 복사해 실행하세요.
-- (테이블 + Realtime + 총점 트리거 + 개발용 RLS + 샘플/계정 시드)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 1. 테이블 ----------

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#007AFF',
  total_score integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.games (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  score_mode    text not null default 'fixed' check (score_mode in ('fixed','ranked')),
  points        integer not null default 0,        -- 고정 점수 (감점은 음수)
  rank_points   integer[] not null default '{}',   -- (MVP 미사용, 모델 유지용)
  staff_ids     uuid[] not null default '{}',      -- 담당 스태프 user.id (부여 권한 기준)
  once_per_team boolean not null default false,    -- 팀당 1회 제한
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  login_id      text unique,                       -- 관리자/스태프 로그인 아이디
  password_hash text,                              -- SHA-256 hex (평문 저장 금지)
  role          text not null default 'staff' check (role in ('admin','staff')),
  game_scope    uuid[] not null default '{}',      -- (모델 유지용, MVP 필터는 games.staff_ids 사용)
  created_at    timestamptz not null default now()
);

create table if not exists public.score_entries (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  game_id    uuid not null references public.games(id) on delete cascade,
  points     integer not null,
  rank       integer,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  voided     boolean not null default false
);

create index if not exists idx_score_entries_team on public.score_entries(team_id);
create index if not exists idx_score_entries_game on public.score_entries(game_id);

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

-- ---------- 3. Realtime 활성화 ----------
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

-- ---------- 4. RLS (개발용 · 운영 전 반드시 강화) ----------
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

-- ---------- 5. 시드 (테스트용, 원치 않으면 이 블록 삭제) ----------
insert into public.teams (name, color, total_score) values
  ('사자팀',   '#FF9500', 0),
  ('독수리팀', '#007AFF', 0),
  ('불꽃팀',   '#FF3B30', 0),
  ('바람팀',   '#34C759', 0);

insert into public.users (name, login_id, password_hash, role) values
  ('리더',     'admin',  encode(digest('1234','sha256'),'hex'), 'admin'),
  ('김집사',   'staff1', encode(digest('1111','sha256'),'hex'), 'staff'),
  ('이전도사', 'staff2', encode(digest('2222','sha256'),'hex'), 'staff');

insert into public.games (name, score_mode, points, once_per_team, staff_ids) values
  ('보물찾기',   'fixed',  50, true,  array(select id from public.users where login_id='staff1')),
  ('성경 퀴즈',  'fixed',  30, false, array(select id from public.users where login_id='staff2')),
  ('찬양 미션',  'fixed',  20, false, array(select id from public.users where login_id='staff2')),
  ('지각 페널티','fixed', -10, false, array(select id from public.users where login_id in ('staff1','staff2')));
```

- [ ] **Step 2: 자체 리뷰**

확인: `users.login_id` unique, `password_hash`는 pgcrypto `digest` 사용(클라이언트 SHA-256 hex와 동일 알고리즘), 트리거가 insert/update/delete 및 team_id 변경을 모두 처리, `games` 시드가 `users` 시드 이후에 위치해 `staff_ids` 서브쿼리가 유효.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): users ID/PW 컬럼·총점 트리거·시드 계정 추가"
```

> **적용 안내(사람):** 이 SQL을 Supabase SQL Editor에 붙여넣어 실행해야 이후 화면이 동작한다. 기존 테이블이 있으면 `users` 컬럼 변경을 위해 재실행 전 기존 정책/테이블 상태를 확인할 것.

---

## Task 2: Vitest 도입 + 인증 라이브러리(`auth.ts`)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/auth.ts`
- Create: `src/lib/auth.hash.test.ts`
- Create: `src/lib/auth.session.test.ts`

**Interfaces:**
- Produces:
  - `sha256Hex(text: string): Promise<string>` — 64자 소문자 hex
  - `interface Session { userId: string; name: string; role: "admin"|"staff"|"viewer"; gameScope: string[]; token: string }`
  - `saveSession(s: Session): void` / `loadSession(): Session | null` / `clearSession(): void`
  - `viewerSession(): Session`
  - `login(loginId: string, password: string): Promise<Session>` — 실패 시 throw Error(한글 메시지)

- [ ] **Step 1: 의존성 추가 및 스크립트 등록**

`package.json`의 `scripts`에 추가:
```json
"test": "vitest run",
"test:watch": "vitest"
```
`devDependencies`에 추가:
```json
"vitest": "^2.1.1",
"jsdom": "^25.0.0"
```
설치:
```bash
npm install
```

- [ ] **Step 2: `vitest.config.ts` 생성**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom", globals: true },
});
```

- [ ] **Step 3: 실패 테스트 작성 — 해시 (`src/lib/auth.hash.test.ts`)**

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
    const h = await sha256Hex("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 4: 실패 테스트 작성 — 세션 (`src/lib/auth.session.test.ts`)**

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { saveSession, loadSession, clearSession, viewerSession, type Session } from "@/lib/auth";

const sample: Session = { userId: "u1", name: "김집사", role: "staff", gameScope: [], token: "t" };

describe("session storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a saved session", () => {
    saveSession(sample);
    expect(loadSession()).toEqual(sample);
  });
  it("returns null when empty", () => {
    expect(loadSession()).toBeNull();
  });
  it("returns null on corrupt json", () => {
    localStorage.setItem("dtscore.session", "not-json");
    expect(loadSession()).toBeNull();
  });
  it("clearSession removes it", () => {
    saveSession(sample);
    clearSession();
    expect(loadSession()).toBeNull();
  });
  it("viewerSession has viewer role", () => {
    expect(viewerSession().role).toBe("viewer");
  });
});
```

- [ ] **Step 5: 테스트 실패 확인**

Run: `npm run test`
Expected: FAIL — `@/lib/auth` 모듈 없음 / export 없음.

- [ ] **Step 6: `src/lib/auth.ts` 구현**

```ts
import { supabase } from "@/lib/supabase";

export type SessionRole = "admin" | "staff" | "viewer";

export interface Session {
  userId: string;
  name: string;
  role: SessionRole;
  gameScope: string[];
  token: string;
}

const SESSION_KEY = "dtscore.session";

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeToken(userId: string): string {
  // 세션 유지용 식별자 (보안 토큰 아님)
  return `${userId}.${Date.now().toString(36)}`;
}

export function saveSession(s: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function viewerSession(): Session {
  return { userId: "viewer", name: "게스트", role: "viewer", gameScope: [], token: "viewer" };
}

export async function login(loginId: string, password: string): Promise<Session> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, role, gameScope:game_scope, passwordHash:password_hash")
    .eq("login_id", loginId.trim())
    .maybeSingle();

  if (error) throw new Error("로그인 중 오류가 발생했습니다.");
  if (!data) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");

  const row = data as unknown as {
    id: string; name: string; role: "admin" | "staff"; gameScope: string[]; passwordHash: string | null;
  };
  const hash = await sha256Hex(password);
  if (!row.passwordHash || hash !== row.passwordHash) {
    throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  const session: Session = {
    userId: row.id,
    name: row.name,
    role: row.role,
    gameScope: row.gameScope ?? [],
    token: makeToken(row.id),
  };
  saveSession(session);
  return session;
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npm run test`
Expected: PASS (7 tests). 이어서 `npm run typecheck` 도 PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/auth.ts src/lib/auth.hash.test.ts src/lib/auth.session.test.ts
git commit -m "feat(auth): SHA-256 해시·세션·로그인 검증 + Vitest 도입"
```

---

## Task 3: 타입 확장 · AuthContext · 라우트 가드

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/context/AuthContext.tsx`
- Create: `src/components/RequireRole.tsx`

**Interfaces:**
- Consumes: `Session`, `loadSession`, `clearSession` (Task 2).
- Produces:
  - `User` 타입에 `loginId: string | null` 추가.
  - `AuthProvider` 컴포넌트, `useAuth(): { session: Session|null; ready: boolean; setSession(s: Session|null): void; logout(): void }`.
  - `RequireRole({ roles, children }: { roles: SessionRole[]; children: React.ReactNode })`.

- [ ] **Step 1: `src/types/index.ts`의 `User` 인터페이스 수정**

기존:
```ts
export interface User {
  id: string;
  name: string;
  role: Role;
  gameScope: string[]; // 담당 게임 범위 (staff)
}
```
교체:
```ts
export interface User {
  id: string;
  name: string;
  loginId: string | null; // 로그인 아이디 (뷰어 계정 없음)
  role: Role;
  gameScope: string[]; // 담당 게임 범위 (모델 유지용)
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
    () => ({
      session,
      ready,
      setSession,
      logout: () => {
        clearSession();
        setSession(null);
      },
    }),
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
  if (!roles.includes(session.role)) return <Navigate to="/scoreboard" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 4: 타입 체크**

Run: `npm run typecheck`
Expected: PASS (아직 App.tsx가 미사용해도 컴파일됨).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/context/AuthContext.tsx src/components/RequireRole.tsx
git commit -m "feat(auth): User.loginId·AuthContext·RequireRole 가드 추가"
```

---

## Task 4: 뮤테이션 API · 실시간 훅(scoreEntries, users)

**Files:**
- Create: `src/lib/api.ts`
- Create: `src/hooks/useScoreEntries.ts`
- Create: `src/hooks/useUsers.ts`

**Interfaces:**
- Consumes: `supabase` (기존), 타입 `Team/Game/ScoreEntry/User`.
- Produces:
  - `awardScore(teamId, gameId, points, createdBy): Promise<string>`
  - `voidEntry(entryId): Promise<void>`
  - `createTeam(name, color)` / `updateTeam(id, patch)` / `deleteTeam(id)`
  - `interface GameInput { name; points; oncePerTeam; staffIds; active }`
  - `createGame(g: GameInput)` / `updateGame(id, g: GameInput)` / `deleteGame(id)`
  - `useScoreEntries(limit?): { entries: ScoreEntry[]; loading: boolean }`
  - `useUsers(): { users: User[] }`

- [ ] **Step 1: `src/lib/api.ts` 생성**

```ts
import { supabase } from "@/lib/supabase";
import type { Team } from "@/types";

export async function awardScore(
  teamId: string,
  gameId: string,
  points: number,
  createdBy: string
): Promise<string> {
  const { data, error } = await supabase
    .from("score_entries")
    .insert({ team_id: teamId, game_id: gameId, points, created_by: createdBy, voided: false })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function voidEntry(entryId: string): Promise<void> {
  const { error } = await supabase.from("score_entries").update({ voided: true }).eq("id", entryId);
  if (error) throw error;
}

export async function createTeam(name: string, color: string): Promise<void> {
  const { error } = await supabase.from("teams").insert({ name, color });
  if (error) throw error;
}

export async function updateTeam(id: string, patch: Partial<Pick<Team, "name" | "color">>): Promise<void> {
  const { error } = await supabase.from("teams").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw error;
}

export interface GameInput {
  name: string;
  points: number;
  oncePerTeam: boolean;
  staffIds: string[];
  active: boolean;
}

export async function createGame(g: GameInput): Promise<void> {
  const { error } = await supabase.from("games").insert({
    name: g.name,
    score_mode: "fixed",
    points: g.points,
    rank_points: [],
    once_per_team: g.oncePerTeam,
    staff_ids: g.staffIds,
    active: g.active,
  });
  if (error) throw error;
}

export async function updateGame(id: string, g: GameInput): Promise<void> {
  const { error } = await supabase
    .from("games")
    .update({
      name: g.name,
      points: g.points,
      once_per_team: g.oncePerTeam,
      staff_ids: g.staffIds,
      active: g.active,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteGame(id: string): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 2: `src/hooks/useScoreEntries.ts` 생성**

```ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ScoreEntry } from "@/types";

// 점수 기록을 최신순으로 실시간 구독.
export function useScoreEntries(limit = 100) {
  const [entries, setEntries] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("score_entries")
        .select(
          "id, teamId:team_id, gameId:game_id, points, rank, createdBy:created_by, createdAt:created_at, voided"
        )
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

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [limit]);

  return { entries, loading };
}
```

- [ ] **Step 3: `src/hooks/useUsers.ts` 생성**

```ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@/types";

// 사용자(스태프/관리자) 목록 구독. 관리자 콘솔 스태프 배정에 사용.
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("users")
        .select("id, name, loginId:login_id, role, gameScope:game_scope")
        .order("name");
      if (active && data) setUsers(data as unknown as User[]);
    }
    void load();

    const channel = supabase
      .channel("users-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => void load())
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { users };
}
```

- [ ] **Step 4: 타입 체크**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/hooks/useScoreEntries.ts src/hooks/useUsers.ts
git commit -m "feat(data): 뮤테이션 API·scoreEntries·users 훅 추가"
```

---

## Task 5: Login 화면 — ID/PW + 게스트 입장

**Files:**
- Modify: `src/pages/Login.tsx`

**Interfaces:**
- Consumes: `useAuth().setSession` (Task 3), `login`, `viewerSession` (Task 2), 기존 UI 컴포넌트.

- [ ] **Step 1: `src/pages/Login.tsx` 전체 교체**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Trophy, User, KeyRound, ArrowRight, Eye } from "lucide-react";
import { Screen, Blob, Content, WhiteButton, GhostButton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { login, viewerSession } from "@/lib/auth";

const Center = styled.div`
  flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 28px;
`;
const Logo = styled.div`
  width: 88px; height: 88px; border-radius: 28px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(160deg, rgba(255,255,255,.35), rgba(255,255,255,.12));
  border: 1px solid rgba(255,255,255,.4);
  box-shadow: 0 12px 40px rgba(40,20,90,.4), inset 0 1px 0 rgba(255,255,255,.6);
`;
const Field = styled.div`
  display: flex; align-items: center; gap: 13px;
  background: linear-gradient(160deg, rgba(255,255,255,.22), rgba(255,255,255,.08));
  border: 1px solid rgba(255,255,255,.3);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.4);
  border-radius: 20px; padding: 17px 20px;
  & input {
    flex: 1; border: none; background: transparent; outline: none; color: #fff; font-size: 16px;
  }
  & input::placeholder { color: rgba(255,255,255,.6); }
`;
const Divider = styled.div`
  display: flex; align-items: center; gap: 14px;
  font-size: 13px; color: rgba(255,255,255,.45); padding: 4px 0;
  & span { flex: 1; height: 1px; background: rgba(255,255,255,.25); }
`;
const ErrorText = styled.div`
  font-size: 13px; color: #ffd7de; text-align: center;
`;

export default function Login() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const s = await login(loginId, pw);
      setSession(s);
      nav(s.role === "admin" ? "/admin" : "/scoring", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function enterAsViewer() {
    const s = viewerSession();
    setSession(s);
    nav("/scoreboard", { replace: true });
  }

  return (
    <Screen>
      <Blob $size={340} $top="-80px" $left="-40px" $bg="radial-gradient(circle at 35% 35%,rgba(255,255,255,.7),rgba(150,120,255,.2) 60%,transparent 72%)" />
      <Blob $size={200} $top="120px" $left="200px" $bg="radial-gradient(circle,rgba(255,140,180,.5),transparent 65%)" />
      <Content>
        <Center>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Logo><Trophy size={40} color="#fff" /></Logo>
            <div>
              <div style={{ fontSize: 40, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>틴즈 캠프</div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,.72)" }}>실시간 팀 점수판</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field>
              <User size={20} color="rgba(255,255,255,.85)" />
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="아이디 (관리자·스태프)"
                autoCapitalize="none"
              />
            </Field>
            <Field>
              <KeyRound size={20} color="rgba(255,255,255,.85)" />
              <input
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="비밀번호"
                type="password"
                onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
              />
            </Field>

            {error && <ErrorText>{error}</ErrorText>}

            <WhiteButton onClick={() => void submit()}>
              {busy ? "확인 중…" : "로그인"} <ArrowRight size={19} />
            </WhiteButton>

            <Divider><span /> 또는 <span /></Divider>

            <GhostButton onClick={enterAsViewer}>
              <Eye size={18} /> 게스트로 순위 보기
            </GhostButton>
          </div>
        </Center>
      </Content>
    </Screen>
  );
}
```

- [ ] **Step 2: 타입 체크 & 빌드**

Run: `npm run typecheck`
Expected: PASS. (App.tsx 라우팅은 Task 9에서 연결하지만 컴파일은 통과.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/Login.tsx
git commit -m "feat(login): ID/PW 로그인 + 게스트 입장"
```

---

## Task 6: Scoreboard — 실제 총점 연결 · 하드코딩 제거 · 역할별 네비

**Files:**
- Modify: `src/pages/Scoreboard.tsx`

**Interfaces:**
- Consumes: `useTeams` (기존), `useAuth` (Task 3), `teamGradient/teamInitials` (기존).

- [ ] **Step 1: `src/pages/Scoreboard.tsx` 전체 교체**

```tsx
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Crown, Trophy, ClipboardList, Settings2, LogOut } from "lucide-react";
import { Screen, Blob, Content, Glass, Avatar, Display } from "@/components/ui";
import { useTeams } from "@/hooks/useTeams";
import { useAuth } from "@/context/AuthContext";
import { teamGradient, teamInitials } from "@/lib/teamStyle";
import type { Team } from "@/types";

const CAMP_NAME = "틴즈 캠프";

const Header = styled.div`
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;
`;
const Podium = styled.div`
  display: grid; grid-template-columns: 1fr 1.15fr 1fr; align-items: end; gap: 8px; margin-bottom: 16px;
`;
const PodCol = styled.div` display: flex; flex-direction: column; align-items: center; gap: 7px; `;
const PodBar = styled.div<{ $tall?: boolean }>`
  width: 100%; text-align: center;
  background: ${({ $tall }) => ($tall
    ? "linear-gradient(160deg,rgba(255,255,255,.34),rgba(255,255,255,.12))"
    : "linear-gradient(160deg,rgba(255,255,255,.22),rgba(255,255,255,.07))")};
  border: 1px solid rgba(255,255,255,${({ $tall }) => ($tall ? ".45" : ".3")});
  border-radius: ${({ $tall }) => ($tall ? "22px 22px 0 0" : "20px 20px 0 0")};
  padding: ${({ $tall }) => ($tall ? "22px 6px 18px" : "14px 6px 14px")};
`;
const Rank = styled.div<{ $gold?: boolean }>`
  font-family: ${({ theme }) => theme.font.display};
  font-weight: 700; color: ${({ $gold, theme }) => ($gold ? theme.colors.gold : "rgba(230,232,255,.9)")};
  font-size: ${({ $gold }) => ($gold ? "16px" : "15px")};
`;
const ScoreNum = styled.div<{ $big?: boolean }>`
  font-family: ${({ theme }) => theme.font.display};
  font-weight: 700; font-size: ${({ $big }) => ($big ? "30px" : "22px")};
`;
const List = styled(Glass)` padding: 8px; margin-top: 4px; `;
const Row = styled.div` display: flex; align-items: center; gap: 13px; padding: 13px 14px; `;
const Sep = styled.div` height: 1px; background: rgba(255,255,255,.14); `;
const Empty = styled(Glass)` padding: 32px 20px; text-align: center; color: rgba(255,255,255,.72); `;
const NavBar = styled.div`
  margin-top: auto; display: flex; align-items: center; justify-content: center; gap: 12px;
  background: linear-gradient(160deg,rgba(255,255,255,.26),rgba(255,255,255,.1));
  border: 1px solid rgba(255,255,255,.34); border-radius: 26px; padding: 12px 20px;
`;
const NavBtn = styled.button`
  display: flex; align-items: center; gap: 7px; color: #fff; font-size: 13px; font-weight: 600;
  padding: 8px 12px; border-radius: 16px; background: rgba(255,255,255,.12);
`;

export default function Scoreboard() {
  const nav = useNavigate();
  const { teams, loading } = useTeams();
  const { session, logout } = useAuth();
  const ranked = [...teams].sort((a, b) => b.totalScore - a.totalScore);
  const [first, second, third, ...rest] = ranked;
  const idx = (t: Team) => ranked.indexOf(t);

  return (
    <Screen>
      <Blob $size={300} $top="-60px" $left="140px" $bg="radial-gradient(circle at 40% 40%,rgba(255,140,180,.5),transparent 62%)" />
      <Blob $size={240} $top="260px" $left="-70px" $bg="radial-gradient(circle,rgba(120,150,255,.5),transparent 65%)" />
      <Content>
        <Header>
          <div>
            <div style={{ fontSize: 30, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>순위판</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)" }}>
              {CAMP_NAME}{loading ? " · 불러오는 중" : ""}
            </div>
          </div>
          <Trophy size={26} color="#ffd75e" />
        </Header>

        {ranked.length === 0 ? (
          <Empty $variant="soft">아직 점수가 없습니다. 게임이 시작되면 순위가 표시됩니다.</Empty>
        ) : (
          <>
            <Podium>
              {second && (
                <PodCol>
                  <Avatar $bg={teamGradient(idx(second))}>{teamInitials(second.name)}</Avatar>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{second.name}</div>
                  <PodBar><Rank>2</Rank><ScoreNum>{second.totalScore}</ScoreNum></PodBar>
                </PodCol>
              )}
              {first && (
                <PodCol>
                  <Crown size={26} color="#ffd75e" />
                  <Avatar $bg={teamGradient(idx(first))} $size={66} $ring="2px solid #ffd75e">{teamInitials(first.name)}</Avatar>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{first.name}</div>
                  <PodBar $tall><Rank $gold>1</Rank><ScoreNum $big>{first.totalScore}</ScoreNum></PodBar>
                </PodCol>
              )}
              {third && (
                <PodCol>
                  <Avatar $bg={teamGradient(idx(third))}>{teamInitials(third.name)}</Avatar>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{third.name}</div>
                  <PodBar><Rank>3</Rank><ScoreNum>{third.totalScore}</ScoreNum></PodBar>
                </PodCol>
              )}
            </Podium>

            {rest.length > 0 && (
              <List $variant="soft">
                {rest.map((t, i) => (
                  <div key={t.id}>
                    {i > 0 && <Sep />}
                    <Row>
                      <Display style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,.7)", width: 22 }}>
                        {idx(t) + 1}
                      </Display>
                      <Avatar $bg={teamGradient(idx(t))} $size={40} $ring="none" style={{ fontSize: 13 }}>
                        {teamInitials(t.name)}
                      </Avatar>
                      <div style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{t.name}</div>
                      <Display style={{ fontSize: 18, fontWeight: 700 }}>{t.totalScore}</Display>
                    </Row>
                  </div>
                ))}
              </List>
            )}
          </>
        )}

        <NavBar>
          {session?.role === "staff" && (
            <NavBtn onClick={() => nav("/scoring")}><ClipboardList size={18} /> 점수 부여</NavBtn>
          )}
          {session?.role === "admin" && (
            <NavBtn onClick={() => nav("/admin")}><Settings2 size={18} /> 관리자</NavBtn>
          )}
          <NavBtn onClick={() => { logout(); nav("/login", { replace: true }); }}>
            <LogOut size={18} /> {session?.role === "viewer" || !session ? "나가기" : "로그아웃"}
          </NavBtn>
        </NavBar>
      </Content>
    </Screen>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Scoreboard.tsx
git commit -m "feat(scoreboard): 실제 총점 연결·역할별 네비·빈 상태"
```

---

## Task 7: StaffScoring — 담당 게임 선택 → 성공 팀 부여 + Undo

**Files:**
- Modify: `src/pages/StaffScoring.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 3), `useTeams` (기존), `useGames` (기존), `useScoreEntries` (Task 4), `awardScore`, `voidEntry` (Task 4), `teamGradient/teamInitials` (기존).

- [ ] **Step 1: `src/pages/StaffScoring.tsx` 전체 교체**

```tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { ChevronLeft, Check, Undo2, Trophy } from "lucide-react";
import { Screen, Blob, Content, Glass, Avatar, Display } from "@/components/ui";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import { useScoreEntries } from "@/hooks/useScoreEntries";
import { useAuth } from "@/context/AuthContext";
import { awardScore, voidEntry } from "@/lib/api";
import { teamGradient, teamInitials } from "@/lib/teamStyle";

const Header = styled.div` display: flex; align-items: center; gap: 12px; margin-bottom: 16px; `;
const IconBtn = styled.button`
  width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.3);
`;
const GameTabs = styled.div` display: flex; gap: 8px; overflow-x: auto; margin-bottom: 14px; padding-bottom: 2px; `;
const GameTab = styled.button<{ $on?: boolean }>`
  flex-shrink: 0; padding: 10px 15px; border-radius: 14px; font-size: 14px; font-weight: 600;
  color: ${({ $on }) => ($on ? "#4b2ea8" : "#fff")};
  background: ${({ $on }) => ($on ? "#fff" : "rgba(255,255,255,.14)")};
  border: 1px solid rgba(255,255,255,.28);
`;
const PointBadge = styled.span`
  margin-left: 6px; font-size: 12px; opacity: .75; font-family: ${({ theme }) => theme.font.display};
`;
const Grid = styled.div` display: grid; grid-template-columns: 1fr 1fr; gap: 12px; `;
const TeamBtn = styled.button<{ $done?: boolean }>`
  display: flex; align-items: center; gap: 12px; padding: 15px; border-radius: 20px; text-align: left;
  background: ${({ theme }) => theme.glass.medium};
  border: ${({ theme }) => theme.glass.border};
  opacity: ${({ $done }) => ($done ? 0.45 : 1)};
  &:active { transform: ${({ $done }) => ($done ? "none" : "scale(0.98)")}; }
`;
const Recent = styled(Glass)` margin-top: 16px; padding: 12px 14px; `;
const RecentRow = styled.div`
  display: flex; align-items: center; gap: 10px; padding: 9px 4px; font-size: 14px;
`;
const UndoBtn = styled.button`
  margin-left: auto; display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600;
  color: #ffd7de; padding: 6px 10px; border-radius: 12px; background: rgba(255,255,255,.12);
`;
const Note = styled(Glass)` padding: 28px 20px; text-align: center; color: rgba(255,255,255,.75); `;

export default function StaffScoring() {
  const nav = useNavigate();
  const { session } = useAuth();
  const { teams } = useTeams();
  const { games } = useGames();
  const { entries } = useScoreEntries();

  const myGames = useMemo(
    () => games.filter((g) => g.active && session && g.staffIds.includes(session.userId)),
    [games, session]
  );
  const [gameId, setGameId] = useState<string | null>(null);
  const activeGameId = gameId ?? myGames[0]?.id ?? null;
  const game = myGames.find((g) => g.id === activeGameId) ?? null;

  // 이 게임에서 이미 부여된(취소 안 된) 팀 id
  const scoredTeamIds = useMemo(
    () => new Set(entries.filter((e) => e.gameId === activeGameId && !e.voided).map((e) => e.teamId)),
    [entries, activeGameId]
  );
  // 방금 부여 내역(이 게임, 이 스태프, 최신순)
  const recent = useMemo(
    () =>
      entries
        .filter((e) => e.gameId === activeGameId && !e.voided && e.createdBy === session?.userId)
        .slice(0, 6),
    [entries, activeGameId, session]
  );
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "팀";

  const [busy, setBusy] = useState<string | null>(null);

  async function give(teamId: string) {
    if (!game || !session) return;
    if (game.oncePerTeam && scoredTeamIds.has(teamId)) return;
    setBusy(teamId);
    try {
      await awardScore(teamId, game.id, game.points, session.userId);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Blob $size={280} $top="-50px" $left="150px" $bg="radial-gradient(circle at 40% 40%,rgba(120,150,255,.55),transparent 62%)" />
      <Blob $size={220} $top="240px" $left="-60px" $bg="radial-gradient(circle,rgba(180,120,255,.45),transparent 65%)" />
      <Content>
        <Header>
          <IconBtn onClick={() => nav("/scoreboard")}><ChevronLeft size={22} color="#fff" /></IconBtn>
          <Display style={{ fontSize: 19, fontWeight: 700 }}>점수 부여</Display>
        </Header>

        {myGames.length === 0 ? (
          <Note $variant="soft">배정된 게임이 없습니다. 관리자에게 문의하세요.</Note>
        ) : (
          <>
            <GameTabs>
              {myGames.map((g) => (
                <GameTab key={g.id} $on={g.id === activeGameId} onClick={() => setGameId(g.id)}>
                  {g.name}
                  <PointBadge>{g.points >= 0 ? `+${g.points}` : g.points}</PointBadge>
                </GameTab>
              ))}
            </GameTabs>

            <Grid>
              {teams.map((t, i) => {
                const done = game?.oncePerTeam && scoredTeamIds.has(t.id);
                return (
                  <TeamBtn key={t.id} $done={!!done} disabled={!!done || busy === t.id} onClick={() => void give(t.id)}>
                    <Avatar $bg={teamGradient(i)} $size={44} $ring="none">{teamInitials(t.name)}</Avatar>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>
                        <Trophy size={11} /> {t.totalScore}점
                      </div>
                    </div>
                    {done && <Check size={18} color="#9ff5c8" />}
                  </TeamBtn>
                );
              })}
            </Grid>

            {recent.length > 0 && (
              <Recent $variant="soft">
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.65)", padding: "2px 4px 6px" }}>
                  방금 준 점수
                </div>
                {recent.map((e) => (
                  <RecentRow key={e.id}>
                    <Check size={15} color="#9ff5c8" />
                    <span>{teamName(e.teamId)}</span>
                    <Display style={{ fontWeight: 700 }}>{e.points >= 0 ? `+${e.points}` : e.points}</Display>
                    <UndoBtn onClick={() => void voidEntry(e.id)}><Undo2 size={14} /> 취소</UndoBtn>
                  </RecentRow>
                ))}
              </Recent>
            )}
          </>
        )}
      </Content>
    </Screen>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/StaffScoring.tsx
git commit -m "feat(scoring): 담당 게임 성공 팀 고정 점수 부여 + Undo"
```

---

## Task 8: AdminConsole — 팀/게임/기록 3패널 CRUD

**Files:**
- Create: `src/components/admin/TeamsPanel.tsx`
- Create: `src/components/admin/GamesPanel.tsx`
- Create: `src/components/admin/EntriesPanel.tsx`
- Modify: `src/pages/AdminConsole.tsx`

**Interfaces:**
- Consumes: `useTeams/useGames` (기존), `useUsers/useScoreEntries` (Task 4), api.ts 전체 (Task 4).
- Produces: 세 패널 컴포넌트(default export), 탭 컨테이너 `AdminConsole`.

- [ ] **Step 1: 공용 스타일을 각 패널에 인라인으로 두고 `TeamsPanel.tsx` 생성**

```tsx
import { useState } from "react";
import styled from "styled-components";
import { Plus, Trash2 } from "lucide-react";
import { Glass } from "@/components/ui";
import { useTeams } from "@/hooks/useTeams";
import { createTeam, deleteTeam } from "@/lib/api";

const Card = styled(Glass)` padding: 14px; margin-bottom: 10px; `;
const Row = styled.div` display: flex; align-items: center; gap: 10px; `;
const Field = styled.input`
  flex: 1; min-width: 0; border: 1px solid rgba(255,255,255,.28); border-radius: 12px;
  padding: 11px 13px; background: rgba(255,255,255,.1); color: #fff; font-size: 14px;
  &::placeholder { color: rgba(255,255,255,.55); }
`;
const ColorDot = styled.span<{ $c: string }>`
  width: 26px; height: 26px; border-radius: 50%; background: ${({ $c }) => $c}; flex-shrink: 0;
  border: 2px solid rgba(255,255,255,.5);
`;
const AddBtn = styled.button`
  display: flex; align-items: center; justify-content: center; gap: 6px; padding: 11px 14px;
  border-radius: 12px; background: #fff; color: #4b2ea8; font-weight: 700; font-size: 14px; flex-shrink: 0;
`;
const IconBtn = styled.button` padding: 8px; border-radius: 10px; background: rgba(255,255,255,.12); `;

export default function TeamsPanel() {
  const { teams } = useTeams();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#FF9500");

  async function add() {
    if (!name.trim()) return;
    await createTeam(name.trim(), color);
    setName("");
  }

  return (
    <div>
      <Card $variant="soft">
        <Row>
          <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="팀 이름" />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                 style={{ width: 40, height: 40, border: "none", background: "none" }} />
          <AddBtn onClick={() => void add()}><Plus size={16} /> 추가</AddBtn>
        </Row>
      </Card>

      {teams.map((t) => (
        <Card key={t.id} $variant="soft">
          <Row>
            <ColorDot $c={t.color} />
            <div style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{t.name}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)" }}>{t.totalScore}점</div>
            <IconBtn onClick={() => void deleteTeam(t.id)}><Trash2 size={16} color="#ffb3c0" /></IconBtn>
          </Row>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `GamesPanel.tsx` 생성 (게임 CRUD + 스태프 배정)**

```tsx
import { useState } from "react";
import styled from "styled-components";
import { Plus, Trash2 } from "lucide-react";
import { Glass } from "@/components/ui";
import { useGames } from "@/hooks/useGames";
import { useUsers } from "@/hooks/useUsers";
import { createGame, deleteGame, updateGame, type GameInput } from "@/lib/api";

const Card = styled(Glass)` padding: 14px; margin-bottom: 10px; `;
const Row = styled.div` display: flex; align-items: center; gap: 10px; flex-wrap: wrap; `;
const Field = styled.input`
  border: 1px solid rgba(255,255,255,.28); border-radius: 12px; padding: 11px 13px;
  background: rgba(255,255,255,.1); color: #fff; font-size: 14px;
  &::placeholder { color: rgba(255,255,255,.55); }
`;
const Chip = styled.button<{ $on?: boolean }>`
  padding: 7px 11px; border-radius: 11px; font-size: 12.5px; font-weight: 600;
  color: ${({ $on }) => ($on ? "#4b2ea8" : "#fff")};
  background: ${({ $on }) => ($on ? "#fff" : "rgba(255,255,255,.14)")};
  border: 1px solid rgba(255,255,255,.28);
`;
const AddBtn = styled.button`
  display: flex; align-items: center; gap: 6px; padding: 11px 14px; border-radius: 12px;
  background: #fff; color: #4b2ea8; font-weight: 700; font-size: 14px;
`;
const IconBtn = styled.button` padding: 8px; border-radius: 10px; background: rgba(255,255,255,.12); `;
const Label = styled.div` font-size: 12px; color: rgba(255,255,255,.6); margin: 6px 0 4px; `;

export default function GamesPanel() {
  const { games } = useGames();
  const { users } = useUsers();
  const staff = users.filter((u) => u.role === "staff");

  const [name, setName] = useState("");
  const [points, setPoints] = useState("30");
  const [oncePerTeam, setOncePerTeam] = useState(false);
  const [staffIds, setStaffIds] = useState<string[]>([]);

  function toggleStaff(id: string) {
    setStaffIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function add() {
    if (!name.trim()) return;
    const g: GameInput = {
      name: name.trim(),
      points: Number(points) || 0,
      oncePerTeam,
      staffIds,
      active: true,
    };
    await createGame(g);
    setName(""); setPoints("30"); setOncePerTeam(false); setStaffIds([]);
  }

  return (
    <div>
      <Card $variant="soft">
        <Row>
          <Field style={{ flex: 1, minWidth: 120 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="게임 이름" />
          <Field style={{ width: 80 }} value={points} onChange={(e) => setPoints(e.target.value)} placeholder="점수" inputMode="numeric" />
        </Row>
        <Label>담당 스태프</Label>
        <Row>
          {staff.length === 0 && <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)" }}>등록된 스태프 없음</span>}
          {staff.map((u) => (
            <Chip key={u.id} $on={staffIds.includes(u.id)} onClick={() => toggleStaff(u.id)}>{u.name}</Chip>
          ))}
        </Row>
        <Row style={{ marginTop: 10, justifyContent: "space-between" }}>
          <Chip $on={oncePerTeam} onClick={() => setOncePerTeam((v) => !v)}>팀당 1회 {oncePerTeam ? "ON" : "OFF"}</Chip>
          <AddBtn onClick={() => void add()}><Plus size={16} /> 게임 추가</AddBtn>
        </Row>
      </Card>

      {games.map((g) => (
        <Card key={g.id} $variant="soft">
          <Row style={{ justifyContent: "space-between" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {g.name} <span style={{ fontSize: 13, color: "rgba(255,255,255,.6)" }}>{g.points >= 0 ? `+${g.points}` : g.points}</span>
            </div>
            <Row>
              <Chip $on={g.active} onClick={() => void updateGame(g.id, {
                name: g.name, points: g.points, oncePerTeam: g.oncePerTeam, staffIds: g.staffIds, active: !g.active,
              })}>{g.active ? "진행중" : "중지"}</Chip>
              <IconBtn onClick={() => void deleteGame(g.id)}><Trash2 size={16} color="#ffb3c0" /></IconBtn>
            </Row>
          </Row>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginTop: 6 }}>
            담당: {g.staffIds.map((id) => staff.find((u) => u.id === id)?.name).filter(Boolean).join(", ") || "없음"}
            {g.oncePerTeam ? " · 팀당 1회" : ""}
          </div>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `EntriesPanel.tsx` 생성 (기록 열람·취소)**

```tsx
import styled from "styled-components";
import { Undo2 } from "lucide-react";
import { Glass } from "@/components/ui";
import { useScoreEntries } from "@/hooks/useScoreEntries";
import { useTeams } from "@/hooks/useTeams";
import { useGames } from "@/hooks/useGames";
import { voidEntry } from "@/lib/api";

const Card = styled(Glass)` padding: 10px 14px; margin-bottom: 8px; `;
const Row = styled.div` display: flex; align-items: center; gap: 10px; font-size: 14px; `;
const UndoBtn = styled.button`
  margin-left: auto; display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600;
  color: #ffd7de; padding: 6px 10px; border-radius: 11px; background: rgba(255,255,255,.12);
`;

export default function EntriesPanel() {
  const { entries } = useScoreEntries(50);
  const { teams } = useTeams();
  const { games } = useGames();
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "팀";
  const gameName = (id: string) => games.find((g) => g.id === id)?.name ?? "게임";

  if (entries.length === 0) {
    return <Card $variant="soft"><Row>아직 점수 기록이 없습니다.</Row></Card>;
  }

  return (
    <div>
      {entries.map((e) => (
        <Card key={e.id} $variant="soft" style={{ opacity: e.voided ? 0.45 : 1 }}>
          <Row>
            <span style={{ fontWeight: 600 }}>{teamName(e.teamId)}</span>
            <span style={{ color: "rgba(255,255,255,.6)" }}>· {gameName(e.gameId)}</span>
            <span style={{ fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>
              {e.points >= 0 ? `+${e.points}` : e.points}
            </span>
            {e.voided ? (
              <span style={{ marginLeft: "auto", fontSize: 12.5, color: "rgba(255,255,255,.55)" }}>취소됨</span>
            ) : (
              <UndoBtn onClick={() => void voidEntry(e.id)}><Undo2 size={14} /> 취소</UndoBtn>
            )}
          </Row>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: `src/pages/AdminConsole.tsx` 전체 교체 (탭 컨테이너)**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Gamepad2, LogOut, Users, ListChecks } from "lucide-react";
import { Screen, Blob, Content, Display } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import TeamsPanel from "@/components/admin/TeamsPanel";
import GamesPanel from "@/components/admin/GamesPanel";
import EntriesPanel from "@/components/admin/EntriesPanel";

type Tab = "games" | "teams" | "entries";

const Header = styled.div` display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; `;
const Tabs = styled.div` display: flex; gap: 8px; margin-bottom: 16px; `;
const TabBtn = styled.button<{ $on?: boolean }>`
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 11px; border-radius: 14px; font-size: 13.5px; font-weight: 600;
  color: ${({ $on }) => ($on ? "#4b2ea8" : "#fff")};
  background: ${({ $on }) => ($on ? "#fff" : "rgba(255,255,255,.14)")};
  border: 1px solid rgba(255,255,255,.28);
`;
const IconBtn = styled.button`
  width: 42px; height: 42px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28);
`;

export default function AdminConsole() {
  const nav = useNavigate();
  const { logout } = useAuth();
  const [tab, setTab] = useState<Tab>("games");

  return (
    <Screen>
      <Blob $size={300} $top="-60px" $left="150px" $bg="radial-gradient(circle at 40% 40%,rgba(255,140,180,.5),transparent 62%)" />
      <Blob $size={230} $top="250px" $left="-70px" $bg="radial-gradient(circle,rgba(150,120,255,.5),transparent 65%)" />
      <Content>
        <Header>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Gamepad2 size={19} />
              <Display style={{ fontSize: 22, fontWeight: 700 }}>관리자 콘솔</Display>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>틴즈 캠프 · 게임/팀 설정</div>
          </div>
          <IconBtn onClick={() => { logout(); nav("/login", { replace: true }); }}>
            <LogOut size={20} color="#fff" />
          </IconBtn>
        </Header>

        <Tabs>
          <TabBtn $on={tab === "games"} onClick={() => setTab("games")}><Gamepad2 size={16} /> 게임</TabBtn>
          <TabBtn $on={tab === "teams"} onClick={() => setTab("teams")}><Users size={16} /> 팀</TabBtn>
          <TabBtn $on={tab === "entries"} onClick={() => setTab("entries")}><ListChecks size={16} /> 기록</TabBtn>
        </Tabs>

        {tab === "games" && <GamesPanel />}
        {tab === "teams" && <TeamsPanel />}
        {tab === "entries" && <EntriesPanel />}
      </Content>
    </Screen>
  );
}
```

- [ ] **Step 5: 타입 체크**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/TeamsPanel.tsx src/components/admin/GamesPanel.tsx src/components/admin/EntriesPanel.tsx src/pages/AdminConsole.tsx
git commit -m "feat(admin): 팀/게임/기록 3패널 CRUD"
```

---

## Task 9: App 라우팅 — AuthProvider + 역할 가드 · 최종 빌드

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AuthProvider` (Task 3), `RequireRole` (Task 3), 모든 페이지.

- [ ] **Step 1: `src/App.tsx` 전체 교체**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { RequireRole } from "@/components/RequireRole";
import Login from "@/pages/Login";
import Scoreboard from "@/pages/Scoreboard";
import StaffScoring from "@/pages/StaffScoring";
import AdminConsole from "@/pages/AdminConsole";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/scoreboard" element={<Scoreboard />} />
          <Route
            path="/scoring"
            element={
              <RequireRole roles={["staff", "admin"]}>
                <StaffScoring />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole roles={["admin"]}>
                <AdminConsole />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: 전체 타입 체크 · 테스트 · 빌드**

Run:
```bash
npm run typecheck
npm run test
npm run build
```
Expected: 모두 PASS. (`build`는 `tsc --noEmit && vite build`.)

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(routing): AuthProvider + 역할 기반 라우트 가드"
```

- [ ] **Step 4: 수동 검증 (사람, Supabase 연결 필요)**

`.env.local`에 Supabase URL/anon key 설정 + Task 1 SQL 적용 후 `npm run dev`:
1. `admin`/`1234` 로그인 → 관리자 콘솔. 팀 추가/삭제, 게임 추가(담당 스태프 지정), 진행중 토글 동작.
2. `staff1`/`1111` 로그인 → 담당 게임(보물찾기)만 노출. 팀 탭 → 순위판 총점 즉시 증가. "방금 준 점수" 취소 시 감소.
3. 팀당 1회 게임에서 이미 준 팀 비활성화 확인.
4. 게스트 입장 → 순위판만. 주소창에 `/admin` 직접 입력 시 `/scoreboard`로 리다이렉트.
5. 새로고침 후 로그인 세션 유지.

---

## Self-Review

**1. Spec coverage:**
- §1 결정표: 범위(Task 5–9), ID/PW(Task 2·5), SHA-256(Task 2), 세션 토큰(Task 2·3), 고정 점수/총점 정렬(Task 6·7), 총점 트리거(Task 1), RLS 개발용 유지(Task 1) — 모두 커버.
- §2 역할·권한: RequireRole(Task 3), 역할별 네비/화면(Task 5·6·8·9) — 커버.
- §3 스키마: users 컬럼·트리거·시드(Task 1) — 커버.
- §4 파일 구조: 신규/수정 파일 전부 태스크에 존재 — 커버.
- §5 화면: Login(5), StaffScoring(7), AdminConsole(8), Scoreboard(6) — 커버.
- §6 실시간 흐름: 트리거(1) + 기존/신규 훅(4) — 커버.
- §8 검증 기준: Task 9 Step 2·4 — 커버.

**2. Placeholder scan:** "TBD/TODO/적절히 처리" 없음. 모든 코드 스텝에 실제 코드 포함.

**3. Type consistency:** `Session`/`SessionRole`은 Task 2 정의를 3·5·6에서 동일 사용. `GameInput`은 Task 4 정의를 8에서 사용. `awardScore(teamId, gameId, points, createdBy)` 시그니처는 7에서 동일 인자 순서로 호출. `voidEntry(id)`는 7·8에서 동일. Supabase select 별칭(camel:snake)은 훅 전반 일관.

범위 밖(ranked 부여, 별도 내역 페이지, RLS 강화)은 spec §7과 일치하며 의도적으로 제외.
