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
