# 6단계 — 문서/배포 정리 설계

**작성일:** 2026-07-07
**범위:** 문서만 (앱 코드 변경 없음)

## 배경
기존 `README.md` 가 리디자인·역할 로그인 이전 상태(옛 라우트 `/scoreboard`·`/staff`·`/admin`, 옛 페이지명 `StaffScoring`·`AdminConsole`)를 가리켜 신규 환경 셋업에 쓸 수 없었다.

## 변경
- **`README.md` 전면 개정** — 신규 개발자가 이것만 보고 처음부터 실행할 수 있게:
  - 빠른 시작(install → `.env.local` → dev/build/test), 배포 전 `npm run build && npm run test` 회귀 검증 명시.
  - **Supabase SQL 적용 순서 표**: `schema.sql` → `001_auth_rls.sql` → `002_soft_reset_audit.sql`.
  - **관리자/스태프 계정 생성 절차**: 대시보드에서 사람이 직접 auth 사용자 생성(공개 가입 차단) → UID 로 프로필 INSERT. 아이디↔의사 이메일(`아이디@dreamteens.local`) 변환 설명.
  - **라우트·권한 표**: `/board /input /log /manage /present` + `/login`, admin/staff/viewer 접근 매트릭스.
  - 현재 폴더 구조(context/, lib 세분화, hooks 공통훅).
  - **Vercel 배포 체크리스트**: env 변수, Vite preset, `vercel.json` SPA rewrite, Supabase Site URL 등록.
  - 안전장치 요약(RLS, 삭제 대신 비활성화, 초기화 되돌리기·audit_log).

## 완료 기준 충족
- 신규 환경에서 README 만으로 실행 가능(설치→환경변수→SQL 순서→계정→배포).
- SQL 적용 순서가 표로 명확. 각 SQL 파일 상단 주석과 일치.
- `vercel.json`(SPA rewrite)·`.env.example` 는 이미 존재해 README 가 정확히 참조.

## 도입하지 않은 것
- 앱 코드/스키마 변경 없음. 순수 문서 갱신.
