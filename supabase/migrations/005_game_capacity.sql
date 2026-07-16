-- ============================================================
-- 005_game_capacity.sql — 게임당 최대 2팀(1:1 대결) + 게임 종료
-- 적용 순서: schema.sql → 001 → 002 → 003 → 004 → 005_game_capacity.sql
-- Supabase 대시보드 → SQL Editor(postgres 역할)에서 실행하세요.
-- ============================================================

-- ---------- 1. set_team_game 교체: 정원 검사 추가 ----------
-- 모든 게임은 1:1 대결이므로 게임당 활성 팀 2팀이 정원.
-- (클라이언트 상수 MAX_TEAMS_PER_GAME=2 와 짝 — src/lib/constants.ts)
-- games 행을 for update 로 잠가 두 스태프가 동시에 등록해도 3팀이 될 수 없다.
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
  if p_game is not null then
    perform 1 from public.games where id = p_game for update;
    if (select count(*) from public.teams
        where current_game_id = p_game and active and id <> p_team) >= 2 then
      raise exception '이미 2팀이 참여 중이에요.';
    end if;
  end if;
  update public.teams set current_game_id = p_game where id = p_team;
end;
$$;

-- ---------- 2. clear_game: 게임 종료(그 게임의 팀 전원을 대기로) ----------
-- 라운드 전환용. set_team_game 과 같은 SECURITY DEFINER + 역할 검사 패턴.
create or replace function public.clear_game(p_game uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.user_role() not in ('admin', 'staff') then
    raise exception '권한이 없습니다.';
  end if;
  update public.teams set current_game_id = null where current_game_id = p_game;
end;
$$;

revoke all on function public.clear_game(uuid) from public;
grant execute on function public.clear_game(uuid) to authenticated;
