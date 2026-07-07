# 1단계 — 운영 리스크 제거 (Supabase Auth + 실 RLS) 설계

**작성일:** 2026-07-06
**사용자 플랜:** 6단계 운영 안정화 중 1단계
**결정:** 인증 구조 = **Supabase Auth** / 로그인 UX = **아이디 유지(내부 이메일 매핑, 방식 A)**

## 목표
클라이언트에서 `password_hash`를 조회하던 구조와 개발용 전체 허용 RLS를 폐기하고, 서버단(RLS)에서 역할 권한을 강제한다.

## 인증 흐름
- 아이디 → `아이디@dreamteens.local` 가짜 이메일로 매핑(`emailForId`), `supabase.auth.signInWithPassword` 호출.
- 세션은 Supabase가 관리(localStorage 커스텀 토큰 폐기 → 위조 불가).
- `users` = 프로필 테이블(`id`=`auth.users.id` FK, `password_hash` 제거, `name·role·login_id` 유지). 로그인 후 자기 프로필에서 역할을 읽어 UI 구동.
- 게스트 = 비로그인(`role='viewer'`).

## RLS 매트릭스
| 테이블 | select | insert/update | delete |
|--------|--------|---------------|--------|
| teams | 공개 | 관리자 | 관리자 |
| games | 공개 | 관리자 | 관리자 |
| score_entries | 스태프·관리자 | 스태프·관리자(입력 시 `created_by=auth.uid()`) | 관리자 |
| users | 본인 행+관리자 | 관리자 | 관리자 |

- 역할 판별: `public.user_role()` (SECURITY DEFINER, 재귀 방지).
- **총점 트리거 `recalc_team_total`을 SECURITY DEFINER로 재정의** — 스태프 INSERT 시 트리거의 `teams` UPDATE가 RLS(관리자만 쓰기)에 막히지 않도록.

## 라우팅/권한
- `/board`·`/present` 공개(게스트 열람), `/input`·`/log` 스태프·관리자, `/manage` 관리자.
- `RequireRole`은 세션 대신 역할(`role`) 기반. 권한 부족 시 게스트→`/login`, 로그인 사용자→`/board`.

## 운영 DB 적용 순서
1. `supabase/schema.sql` (초기 — 이미 적용됨)
2. `supabase/migrations/001_auth_rls.sql` (본 단계: users 전환·헬퍼·트리거 재정의·정책 교체)
3. Dashboard Authentication: 공개 회원가입 비활성화 + 사용자 생성(`admin@`, `staff1@` dreamteens.local, Auto Confirm)
4. 프로필 INSERT(실제 auth UID로)

## 코드 변경
- `lib/auth.ts`: `emailForId`·`login`(signInWithPassword)·`logout`(signOut). sha256/세션 저장 제거.
- `context/AuthContext.tsx`: Supabase 세션 구독(`onAuthStateChange`)+프로필 역할 로드. `{session,role,name,userId,ready,logout}`.
- `components/RequireRole.tsx`: 역할 기반.
- `components/TabBar.tsx`·`pages/Input.tsx`·`pages/Login.tsx`·`pages/Scoreboard.tsx`: 컨텍스트 API 반영.
- 테스트: sha256/세션 테스트 제거 → `emailForId` 테스트.

## 완료 기준
- anon key만으로 `users` 전체 조회 불가(본인 행도 로그인 필요).
- 게스트=순위 읽기만 / 스태프=점수 입력·취소만 / 관리자=팀·게임·초기화.

## 남은 참고
- 초기 비번(1234/1111) 유지 → 운영 전 변경 권장(6단계 문서화).
- 공개 회원가입 비활성화는 대시보드 설정(SQL 불가).
