-- ============================================================
-- 007_game_room.sql — 게임 방(위치) 이름
-- 적용 순서: schema.sql → 001 → … → 006 → 007_game_room.sql
-- Supabase 대시보드 → SQL Editor(postgres 역할)에서 실행하세요.
-- ============================================================

-- room = 게임이 진행되는 방 이름(예: 201호, 소예배실). 빈 문자열 = 미입력.
alter table public.games
  add column if not exists room text not null default '';
