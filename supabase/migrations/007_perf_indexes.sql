-- ============================================================
-- 007_perf_indexes.sql — 행사 당일 부하 대비 인덱스
-- 적용 순서: schema.sql → 001 → 002 → 003 → 004 → 005 → 006 → 007_perf_indexes.sql
-- Supabase 대시보드 → SQL Editor(postgres 역할)에서 실행하세요.
-- ============================================================

-- 기록 화면(fetchScoreEntries)은 created_at desc + limit 로만 읽는다.
-- 기존 인덱스는 team_id / archived_at 뿐이라 정렬이 매번 seq scan + sort 였다.
create index if not exists idx_score_entries_created
  on public.score_entries(created_at desc);
