# 틴즈 캠프 팀 점수 웹앱

교회 틴즈 캠프(초등 6 ~ 고3)용 실시간 팀 점수 시스템.
리더(관리자)가 팀·게임을 사전 설정하고, 스태프가 성공한 팀에 점수를 부여하면
모든 기기(프로젝터 발표 모드 포함)에 실시간으로 반영된다.

## 기술 스택

- **React 18 + TypeScript + Vite**
- **styled-components** (aqua 테마, 하단 4탭 네비게이션)
- **Supabase** (Postgres + Realtime + Auth + RLS)
- **Vitest** (단위 테스트)
- **Vercel** 배포

---

## 빠른 시작

```bash
npm install

# 환경변수: .env.example 을 복사해 값 입력
cp .env.example .env.local
#   VITE_SUPABASE_URL=https://<project>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon key>
# (Supabase 대시보드 → Project Settings → API 에서 복사)

npm run dev        # 개발 서버 (http://localhost:5173)
npm run build      # 타입체크(tsc --noEmit) + 프로덕션 빌드
npm run preview    # 빌드 결과 미리보기
npm run test       # 단위 테스트 (vitest run)
```

> **배포 전 회귀 검증:** `npm run build && npm run test` 가 모두 통과해야 한다.

---

## Supabase 설정 (신규 프로젝트 기준)

SQL 은 **반드시 아래 순서대로** Supabase 대시보드 → **SQL Editor** (postgres 역할, RLS 우회)에서 실행한다.

| 순서 | 파일 | 내용 |
|------|------|------|
| 1 | `supabase/schema.sql` | 테이블(teams / games / users / score_entries) + 총점 재계산 트리거 |
| 2 | `supabase/migrations/001_auth_rls.sql` | users→프로필 전환(auth.users FK), `user_role()`·트리거 SECURITY DEFINER, 실 RLS 정책 |
| 3 | `supabase/migrations/002_soft_reset_audit.sql` | `archived_at` 소프트 초기화, 팀/게임 `active` 플래그, FK on delete restrict, `audit_log` |

각 파일 상단에 적용 순서와 주의사항이 주석으로 적혀 있다.

### 관리자 / 스태프 계정 생성

계정 생성과 비밀번호 설정은 **대시보드에서 사람이 직접** 수행한다(클라이언트에서 비밀번호를 다루지 않음). `001_auth_rls.sql` 실행 후:

1. **Authentication → Providers → Email**: "Allow new users to sign up" **비활성화**(공개 회원가입 차단).
2. **Authentication → Users → Add user** (Auto Confirm 켜기)로 의사 이메일 계정 생성:
   - `admin@dreamteens.local` / (비밀번호)
   - `staff1@dreamteens.local` / (비밀번호)
   - 로그인 화면에서는 이메일 앞부분(`admin`, `staff1`)만 아이디로 입력한다. 앱이 `아이디@dreamteens.local` 로 변환해 인증한다.
3. 생성된 각 사용자의 **UID** 를 복사해 프로필 행을 INSERT (SQL Editor):

```sql
insert into public.users (id, login_id, name, role) values
  ('<ADMIN_AUTH_UID>',  'admin',  '리더',   'admin'),
  ('<STAFF1_AUTH_UID>', 'staff1', '스태프', 'staff');
```

> 뷰어(그 외 사용자)는 계정 없이 로그인 화면의 **입장** 버튼으로 순위판만 열람한다.

---

## 라우트 · 권한

로그인 역할은 `admin` / `staff` / `viewer` 세 가지. 라우트는 `RequireRole` 로 보호된다.

| 경로 | 화면 | admin | staff | viewer |
|------|------|:-----:|:-----:|:------:|
| `/board` | 실시간 순위판 (기본) | ✅ | ✅ | ✅ |
| `/input` | 점수 입력(+/−) | ✅ | ✅ | – |
| `/log` | 점수 기록 · 취소 | ✅ | ✅ | – |
| `/manage` | 팀/게임 관리 · 초기화 | ✅ | – | – |
| `/present` | 발표(프로젝터) 모드 | ✅ | ✅ | ✅ |
| `/login` | 로그인 / 입장 | 공개 |

`/` 와 알 수 없는 경로는 `/board` 로 리다이렉트된다.

---

## 폴더 구조

```
src/
  pages/       화면 (Login, Scoreboard, Input, Records, Manage, Present)
  components/  UI (AppLayout, TabBar, RequireRole, TeamRankRow, ui)
  context/     AuthContext (세션·역할 구독)
  lib/         supabase 클라이언트, auth, api, queries, mappers,
               database.types, constants  (+ *.test.ts 단위 테스트)
  hooks/       useRealtimeList 공통 훅 + useTeams/useGames/useScoreEntries
  types/       도메인 모델 (Team, Game, ScoreEntry)
  styles/      theme · GlobalStyle (styled-components)
supabase/
  schema.sql, migrations/    (위 "Supabase 설정" 순서대로 적용)
docs/superpowers/            설계 문서(specs) · 실행 계획(plans)
```

---

## Vercel 배포 체크리스트

1. GitHub 저장소를 Vercel 프로젝트로 임포트(Framework Preset: **Vite**).
2. **Environment Variables** 등록(Production / Preview 모두):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Build Command `npm run build`, Output Directory `dist` (Vite 기본값).
4. SPA 라우팅: `vercel.json` 의 rewrite 로 모든 경로를 `index.html` 로 보낸다(새로고침 시 404 방지).
5. 배포 후 Supabase **Authentication → URL Configuration** 의 Site URL 에 배포 도메인을 추가.

---

## 안전장치 요약

- **RLS**: 게스트/뷰어는 teams·games 읽기만, 점수 입력은 staff/admin, 팀·게임 쓰기와 초기화는 admin.
- **삭제 대신 비활성화**: 점수 기록이 연결된 팀/게임은 `on delete restrict` 로 완전 삭제가 막히고, 화면은 `active=false` 비활성화를 안내한다.
- **초기화 되돌리기**: 초기화는 `archived_at` 소프트 처리라 마지막 초기화를 되돌릴 수 있고, `audit_log` 에 시각·실행자가 남는다.
