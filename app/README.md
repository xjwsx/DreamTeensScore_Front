# 틴즈 캠프 팀 점수 웹앱

교회 틴즈 캠프(초등 6 ~ 고3)용 실시간 팀 점수 시스템.
리더가 게임·점수를 사전 설정하고, 게임별 스태프가 성공한 팀에 점수를 부여하면
모든 기기(프로젝터 순위판 포함)에 실시간 반영된다.

## 기술 스택

- React + TypeScript + Vite
- styled-components (iOS 네이티브 컨셉)
- Supabase (Postgres + Realtime)
- Vercel 배포

## 시작하기

```bash
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 에 Supabase URL / anon key 입력

npm run dev        # 개발 서버
npm run build      # 타입체크 + 프로덕션 빌드
npm run preview    # 빌드 결과 미리보기
```

## 폴더 구조

```
src/
  pages/       화면 (Login, Scoreboard, StaffScoring, StaffHistory, AdminConsole)
  components/  재사용 UI 컴포넌트
  lib/         Supabase 클라이언트
  hooks/       실시간 데이터 훅 (useTeams, useGames)
  types/       데이터 모델 타입 (Team, Game, ScoreEntry, User)
  styles/      테마 · 전역 스타일 (styled-components)
```

## 라우트

| 경로 | 화면 |
|------|------|
| `/scoreboard` | 실시간 순위판 (기본) |
| `/login` | 스태프 · 리더 로그인 |
| `/staff` | 스태프 점수 부여 |
| `/staff/history` | 스태프 부여 내역 |
| `/admin` | 관리자 게임 설정 콘솔 |

## 다음 단계

1. Supabase 프로젝트 생성 후 teams / games / score_entries / users 테이블 생성
2. 각 화면 UI 구현 (화면 디자인 프롬프트 문서 참고)
3. Row Level Security 정책으로 권한 제어
4. Vercel에 연결해 배포 (환경변수 등록)
