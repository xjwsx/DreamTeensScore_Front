-- ============================================================
-- 001_auth_rls.sql — 1단계: Supabase Auth 전환 + 실 RLS
-- 적용 순서: schema.sql (초기) → 001_auth_rls.sql (본 파일)
-- 실행 전 대시보드에서 auth 사용자 생성이 필요 없음(정책/구조만).
-- 본 파일 실행 후: (1) Authentication에서 사용자 생성 → (2) 하단
-- 프로필 INSERT 템플릿을 실제 auth UID로 채워 실행.
-- Supabase SQL Editor(postgres 역할, RLS 우회)에서 실행하세요.
-- ============================================================

-- ---------- 1. users 를 프로필 테이블로 전환 ----------
-- 구 비밀번호 기반 시드 제거(score_entries.created_by 는 FK on delete set null)
delete from public.users;

-- 비밀번호 컬럼 제거(비밀번호는 auth.users 로 이동, 클라이언트 조회 불가)
alter table public.users drop column if exists password_hash;

-- id 는 이제 auth.users(id) 를 그대로 사용(자동 생성 default 제거)
alter table public.users alter column id drop default;
alter table public.users drop constraint if exists users_id_fkey;
alter table public.users
  add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;

-- ---------- 2. 역할 판별 헬퍼 (RLS용, 재귀 방지 위해 SECURITY DEFINER) ----------
create or replace function public.user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

-- ---------- 3. 총점 트리거 함수: RLS 우회하도록 SECURITY DEFINER 로 재정의 ----------
-- (스태프의 score_entries INSERT 시 트리거가 teams 를 UPDATE 하는데,
--  teams 쓰기는 관리자만 허용이므로 트리거는 정의자 권한으로 실행해야 함)
create or replace function public.recalc_team_total(p_team uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.teams t
  set total_score = coalesce((
    select sum(points) from public.score_entries
    where team_id = p_team and voided = false
  ), 0)
  where t.id = p_team;
$$;

-- ---------- 4. 개발용 전체 허용 정책 제거 ----------
drop policy if exists "dev all teams"   on public.teams;
drop policy if exists "dev all games"   on public.games;
drop policy if exists "dev all users"   on public.users;
drop policy if exists "dev all entries" on public.score_entries;

-- ---------- 5. 실 RLS 정책 ----------
-- teams: 읽기 공개(게스트 순위판), 쓰기 관리자
drop policy if exists "teams read public"  on public.teams;
drop policy if exists "teams insert admin" on public.teams;
drop policy if exists "teams update admin" on public.teams;
drop policy if exists "teams delete admin" on public.teams;
create policy "teams read public"  on public.teams for select using (true);
create policy "teams insert admin" on public.teams for insert with check (public.user_role() = 'admin');
create policy "teams update admin" on public.teams for update using (public.user_role() = 'admin') with check (public.user_role() = 'admin');
create policy "teams delete admin" on public.teams for delete using (public.user_role() = 'admin');

-- games: 읽기 공개, 쓰기 관리자
drop policy if exists "games read public"  on public.games;
drop policy if exists "games insert admin" on public.games;
drop policy if exists "games update admin" on public.games;
drop policy if exists "games delete admin" on public.games;
create policy "games read public"  on public.games for select using (true);
create policy "games insert admin" on public.games for insert with check (public.user_role() = 'admin');
create policy "games update admin" on public.games for update using (public.user_role() = 'admin') with check (public.user_role() = 'admin');
create policy "games delete admin" on public.games for delete using (public.user_role() = 'admin');

-- score_entries: 읽기·입력·취소 = 스태프/관리자, 삭제 = 관리자
drop policy if exists "entries read staff"   on public.score_entries;
drop policy if exists "entries insert staff" on public.score_entries;
drop policy if exists "entries update staff" on public.score_entries;
drop policy if exists "entries delete admin" on public.score_entries;
create policy "entries read staff"   on public.score_entries for select using (public.user_role() in ('admin','staff'));
create policy "entries insert staff" on public.score_entries for insert with check (public.user_role() in ('admin','staff') and created_by = auth.uid());
create policy "entries update staff" on public.score_entries for update using (public.user_role() in ('admin','staff')) with check (public.user_role() in ('admin','staff'));
create policy "entries delete admin" on public.score_entries for delete using (public.user_role() = 'admin');

-- users(프로필): 본인 행 또는 관리자만 읽기, 쓰기 관리자
drop policy if exists "users read self or admin" on public.users;
drop policy if exists "users insert admin"       on public.users;
drop policy if exists "users update admin"       on public.users;
drop policy if exists "users delete admin"       on public.users;
create policy "users read self or admin" on public.users for select using (id = auth.uid() or public.user_role() = 'admin');
create policy "users insert admin"       on public.users for insert with check (public.user_role() = 'admin');
create policy "users update admin"       on public.users for update using (public.user_role() = 'admin') with check (public.user_role() = 'admin');
create policy "users delete admin"       on public.users for delete using (public.user_role() = 'admin');

-- ============================================================
-- 실행 후 수동 단계:
--   1) Dashboard → Authentication → Providers → Email: "Allow new users
--      to sign up" 비활성화(공개 회원가입 차단).
--   2) Dashboard → Authentication → Users → Add user (Auto Confirm):
--        admin@dreamteens.local  / (비밀번호)
--        staff1@dreamteens.local / (비밀번호)
--   3) 각 사용자의 UID 를 복사해 아래 프로필 INSERT 를 채워 실행:
--
-- insert into public.users (id, login_id, name, role) values
--   ('<ADMIN_AUTH_UID>',  'admin',  '리더',   'admin'),
--   ('<STAFF1_AUTH_UID>', 'staff1', '스태프', 'staff');
-- ============================================================
