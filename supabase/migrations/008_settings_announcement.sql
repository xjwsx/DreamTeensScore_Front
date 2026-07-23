-- ============================================================
-- 008_settings_announcement.sql — 브로드캐스트 알람 설정 행
-- 적용 순서: … → 006_settings_hide_scores.sql → 007_game_room.sql → 008
-- Supabase 대시보드 → SQL Editor(postgres 역할)에서 실행하세요.
-- settings 테이블/RLS/Realtime 은 006 에서 이미 만들어졌으므로 행만 추가한다.
-- ============================================================

-- announcement = { id, message }. admin 이 보낼 때마다 id 가 바뀌고,
-- 접속 중인 클라이언트는 새 id 를 감지해 모달을 띄운다(확인 버튼을 눌러야 닫힘).
insert into public.settings (key, value)
values ('announcement', '{"id":"","message":""}'::jsonb)
on conflict (key) do nothing;
