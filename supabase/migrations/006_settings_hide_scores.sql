-- ============================================================
-- 006_settings_hide_scores.sql — 전역 설정 테이블 + 스코어 가리기
-- 적용 순서: schema.sql → 001 → 002 → 003 → 004 → 005 → 006_settings_hide_scores.sql
-- Supabase 대시보드 → SQL Editor(postgres 역할)에서 실행하세요.
-- ============================================================

-- ---------- 1. 범용 키-값 설정 테이블 ----------
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- hide_scores = true 면 게스트(viewer)의 순위판·발표 모드에서 순위를 숨긴다
insert into public.settings (key, value) values ('hide_scores', 'false'::jsonb)
on conflict (key) do nothing;

-- ---------- 2. RLS: 읽기 공개(게스트가 봐야 함), 쓰기 admin 전용 ----------
alter table public.settings enable row level security;

drop policy if exists "settings read public"  on public.settings;
drop policy if exists "settings update admin" on public.settings;
create policy "settings read public"  on public.settings for select using (true);
create policy "settings update admin" on public.settings for update
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');
-- insert/delete 정책 없음 — 행은 마이그레이션이 만들고 앱은 update 만 한다

-- ---------- 3. Realtime ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='settings') then
    alter publication supabase_realtime add table public.settings;
  end if;
end $$;
