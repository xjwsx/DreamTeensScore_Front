# 틴즈 스코어보드 — 리디자인 구현 설계 (spec v2)

**작성일:** 2026-07-06
**대체:** `2026-07-03-teens-camp-score-mvp-design.md` (로그인/역할·고정점수 방식) — 본 문서가 대체함.
**디자인 소스:** `TeensDesign.html` (디자인 툴 export, 렌더링 분석 완료)

---

## 0. 방향 전환 요약

`TeensDesign.html` 분석 결과, 앱을 **로그인 없는 단일 기기 스코어보드**로 재구성한다. 사용자 확정 결정:

1. **로그인/역할 제거** — 한 기기에서 하단 4개 탭(순위·입력·기록·팀·게임)에 모두 접근.
2. **점수 = 수동 +/− 단위** — 게임은 라벨(이모지+이름), 점수는 입력 화면에서 단위(+1/+5/+10/+50/직접)를 골라 팀별 +/−.
3. **테마 = 청량 아쿠아 하나** (전환 기능 없음).

이에 따라 인증·users·역할 관련 요소는 전부 제거하고, 데이터 모델·화면·테마를 새 디자인에 맞춘다.

---

## 1. 디자인 토큰 (청량 아쿠아)

| 토큰 | 값 |
|------|-----|
| 화면 배경 | `linear-gradient(165deg,#0ea5e9 0%,#22d3ee 45%,#2dd4bf 100%)` |
| 폰트 | **Pretendard** (CDN 로드, 폴백 system-ui) |
| 글래스 카드 | `linear-gradient(160deg,rgba(255,255,255,.24),rgba(150,235,255,.10))`, border `1px solid rgba(255,255,255,.45)` |
| 포인트 색 | sky `#0ea5e9` · cyan `#22d3ee` · teal `#2dd4bf` · amber `#fbbf24` · rose `#fb7185` |
| 메달 | 1위 gold `#fbbf24` · 2위 silver `#cbd5e1` · 3위 bronze `#fb923c` |
| 팀 색 팔레트(8) | `#fb7185 #fbbf24 #a78bfa #4ade80 #38bdf8 #f472b6 #fb923c #2dd4bf` |
| 팀 이모지 프리셋 | `🦁 🐬 🦊 🐨 🐯 🐼 🐵 🦄 🐸 🐷 🐰 🐻` |
| 카드 라운드 | 24px (lg) · 탭/칩 pill |
| 활성 탭 | 흰색 pill(아이콘+라벨) |

기존 `src/components/ui.tsx`의 `Screen/Blob/Content/Glass/Avatar`는 구조 재사용하되, `theme.ts`를 위 토큰으로 교체한다. 보라·핑크 계열 TALLY 테마는 폐기.

---

## 2. 화면 구조 (하단 탭 네비 + 발표 모드)

라우팅은 유지(react-router)하되 **가드 없음**. 레이아웃 라우트가 하단 `TabBar`를 렌더한다.

| 경로 | 탭 | 내용 |
|------|-----|------|
| `/board` | 순위 | 팀 순위 리스트(메달·이모지·진행 막대·점수). 우상단 "발표 모드" 버튼 |
| `/input` | 입력 | 게임 선택(칩) → 점수 단위(+1/+5/+10/+50/직접) → 팀별 −/+ 로 가감 |
| `/log` | 기록 | 점수 기록 로그(팀·게임·증감·시각) + 개별 취소(void) |
| `/manage` | 팀·게임 | 팀 CRUD(이모지·이름·색상), 게임 CRUD(이모지·이름), 전체 초기화 |
| `/present` | (없음) | 발표 모드 — 하단 탭 없는 전체화면 "🏆 실시간 순위", 나가기 버튼 |
| `/` | — | `/board`로 리다이렉트 |

`TabBar`는 4개 메인 경로에만, `/present`엔 없음.

---

## 3. 데이터 모델 변경 (schema.sql 전면 교체)

**users 테이블·인증 관련 전부 제거.** score_entries에서 `created_by` 제거.

### teams
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid pk | |
| name | text | |
| emoji | text | 팀 아바타 (예: '🦁') |
| color | text | 팔레트 색 (hex) |
| total_score | integer | 트리거 유지 |
| created_at | timestamptz | 정렬 기준 |

### games
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid pk | |
| name | text | |
| emoji | text | 게임 아이콘 |
| created_at | timestamptz | 정렬 |

### score_entries
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid pk | |
| team_id | uuid → teams(cascade) | not null |
| game_id | uuid → games(set null) | **nullable** (직접/게임 없이도 부여 가능) |
| points | integer | 적용된 증감(부호 포함) |
| created_at | timestamptz | |
| voided | boolean | 취소 |

### 트리거·기타
- `recalc_team_total(uuid)` + `score_entries` after insert/update/delete 트리거(비-void 합). (기존 방식 유지)
- Realtime: teams·games·score_entries.
- RLS: 개발용 전체 허용(운영 전 강화는 향후).
- 시드: teams 4팀(이모지·색), games 5개(몸으로 말해요/릴레이 달리기/스피드 퀴즈/보물찾기/장기자랑, 이모지 포함). score_entries 없음.

---

## 4. 프론트엔드 구조

### 4.1 신규
| 파일 | 역할 |
|------|------|
| `src/components/TabBar.tsx` | 하단 4탭 네비 |
| `src/components/AppLayout.tsx` | Outlet + TabBar 레이아웃 라우트 |
| `src/components/TeamRankRow.tsx` | 순위/발표용 팀 행(메달·이모지·막대·점수) |
| `src/lib/api.ts` | addScore, voidEntry, 팀·게임 CRUD, resetAll |
| `src/hooks/useScoreEntries.ts` | 점수 기록 구독 |
| `src/pages/Input.tsx` | 입력(점수 부여) |
| `src/pages/Records.tsx` | 기록 |
| `src/pages/Manage.tsx` | 팀·게임 관리 |
| `src/pages/Present.tsx` | 발표 모드 |
| `src/lib/constants.ts` | 팀 색 팔레트·이모지 프리셋·점수 단위 |

### 4.2 수정
| 파일 | 변경 |
|------|------|
| `src/styles/theme.ts` | 아쿠아 토큰으로 교체 |
| `src/styles/GlobalStyle.ts` | Pretendard 적용 |
| `index.html` | Pretendard CDN `<link>` |
| `src/types/index.ts` | Team.emoji 추가, Game 재정의(emoji, points 등 제거), ScoreEntry(created_by 제거, gameId nullable), User 제거 |
| `src/hooks/useTeams.ts` | emoji select 추가 |
| `src/hooks/useGames.ts` | name·emoji select |
| `src/pages/Scoreboard.tsx` | 순위 탭으로 재작성(발표 모드 진입) |
| `src/App.tsx` | 레이아웃 라우트 + 탭 경로, 가드 없음 |

### 4.3 제거
`src/pages/Login.tsx`, `src/pages/StaffScoring.tsx`, `src/pages/AdminConsole.tsx`, `src/components/admin/*`, `src/context/AuthContext.tsx`, `src/components/RequireRole.tsx`, `src/lib/auth.ts` 및 auth 테스트, `src/hooks/useUsers.ts`.

> **참고:** 이 파일들은 이전 방향(로그인/역할)의 산출물로, 아직 실제로 생성되지 않았다(계획 단계였음). 실제 저장소에 존재하는 것은 기존 `Login/StaffScoring/AdminConsole/Scoreboard`뿐이며, 이들도 본 리디자인으로 교체·삭제한다.

---

## 5. 화면별 동작

### 5.1 순위 (`/board`)
- `useTeams` → `total_score` 내림차순. 각 행: 메달(1·2·3)·이모지·이름·진행 막대(점수/최고점)·점수. 좌측 엣지 = 팀 색.
- 우상단 "발표 모드" → `/present`.

### 5.2 입력 (`/input`)
- 게임 선택 칩(가로 스크롤, 없으면 "게임 없음"). 점수 단위 칩(+1/+5/+10/+50/직접). 직접 선택 시 숫자 입력.
- 팀별 행: 이모지·이름·현재 점수·[−][+]. `+` → `addScore(teamId, selectedGameId, +unit)`, `−` → `addScore(..., -unit)`. 트리거가 총점 갱신, Realtime 반영.

### 5.3 기록 (`/log`)
- `useScoreEntries` 최신순. 각 행: 팀·게임·증감(±)·시각. 취소 버튼 → `voidEntry`. 빈 상태 안내.

### 5.4 팀·게임 (`/manage`)
- 팀: "+ 팀 추가". 카드마다 이모지(프리셋에서 선택)·이름(인라인 수정)·색상 팔레트(8)·삭제.
- 게임: "+ 게임 추가". 카드마다 이모지·이름(수정)·삭제.
- "전체 점수·기록 초기화" → `resetAll()`(모든 score_entries 삭제 → 트리거로 총점 0).

### 5.5 발표 모드 (`/present`)
- 하단 탭 없이 전체화면 순위. 실시간 재정렬. "나가기" → `/board`.
- (선택 폴리시) 순위 변동 화살표·선두 교체 축하는 v2로 미룸.

---

## 6. 범위 밖 (향후)
- 테마 전환(트로피컬 선셋/오로라), 순위 변동 애니메이션·선두 축하, 로그인/권한, 다중 캠프, 통계 리포트.

---

## 7. 검증 기준
- `npm run typecheck` / `npm run build` 통과.
- 팀·게임 추가/수정/삭제, 색상·이모지 변경 동작.
- 입력 탭에서 단위 선택 후 +/− → 순위 총점 즉시 반영, 기록에 남고 취소 시 복원.
- 발표 모드 전체화면 표시 및 실시간 반영.
- 전체 초기화 시 모든 총점 0.
