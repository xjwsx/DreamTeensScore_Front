-- ============================================================
-- 004_game_floor.sql — 게임 층(1층/2층)
-- 적용 순서: schema.sql → 001_auth_rls.sql → 002_soft_reset_audit.sql
--            → 003_team_location.sql → 004_game_floor.sql
-- Supabase 대시보드 → SQL Editor(postgres 역할)에서 실행하세요.
-- ============================================================

-- floor = 게임이 위치한 층(1 또는 2). 기존 게임은 전부 1층으로 시작.
-- games 쓰기는 기존 RLS(관리자 전용 update) 그대로 — 새 정책·RPC 불필요.
alter table public.games
  add column if not exists floor smallint not null default 1
  check (floor in (1, 2));
