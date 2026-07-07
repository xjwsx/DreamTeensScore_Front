-- ============================================================
-- 002_soft_reset_audit.sql — 2단계: 삭제/초기화 안전화
-- 적용 순서: schema.sql → 001_auth_rls.sql → 002_soft_reset_audit.sql
-- Supabase SQL Editor(postgres 역할)에서 실행하세요.
-- ============================================================

-- ---------- 1. 컬럼 추가 ----------
-- 초기화 = soft(보관): archived_at 이 채워진 기록은 총점에서 제외되나 보존됨
alter table public.score_entries add column if not exists archived_at timestamptz;
create index if not exists idx_score_entries_archived on public.score_entries(archived_at);

-- 팀/게임 비활성화(삭제 대신): active=false 는 화면에서 숨기되 기록은 보존
alter table public.teams add column if not exists active boolean not null default true;
alter table public.games add column if not exists active boolean not null default true;

-- ---------- 2. 총점 재계산: voided + archived 제외 ----------
create or replace function public.recalc_team_total(p_team uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.teams t
  set total_score = coalesce((
    select sum(points) from public.score_entries
    where team_id = p_team and voided = false and archived_at is null
  ), 0)
  where t.id = p_team;
$$;

-- ---------- 3. FK 를 restrict 로: 기록 있는 팀/게임은 DB단에서 삭제 차단 ----------
alter table public.score_entries drop constraint if exists score_entries_team_id_fkey;
alter table public.score_entries
  add constraint score_entries_team_id_fkey foreign key (team_id) references public.teams(id) on delete restrict;

alter table public.score_entries drop constraint if exists score_entries_game_id_fkey;
alter table public.score_entries
  add constraint score_entries_game_id_fkey foreign key (game_id) references public.games(id) on delete restrict;

-- ---------- 4. 감사 로그 ----------
create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  action     text not null,            -- reset | reset_undo | team_activate | team_deactivate | game_activate | game_deactivate | team_delete | game_delete
  actor      uuid references public.users(id) on delete set null,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;
drop policy if exists "audit insert staff" on public.audit_log;
drop policy if exists "audit read admin"   on public.audit_log;
-- 기록(insert)은 스태프/관리자, 열람(select)은 관리자만
create policy "audit insert staff" on public.audit_log for insert with check (public.user_role() in ('admin','staff'));
create policy "audit read admin"   on public.audit_log for select using (public.user_role() = 'admin');
