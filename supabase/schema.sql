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
