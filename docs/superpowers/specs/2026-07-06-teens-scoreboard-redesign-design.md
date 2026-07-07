# 틴즈 스코어보드 — 리디자인 구현 설계 (spec v2)

**작성일:** 2026-07-06
**대체:** `2026-07-03-teens-camp-score-mvp-design.md` — 본 문서가 대체함.
**디자인 소스:** `TeensDesign.html` (디자인 툴 export, 렌더링 분석 완료)

---

## 0. 방향 요약

`TeensDesign.html`의 **아쿠아 비주얼 + 하단 4탭 구조 + 수동 +/− 점수**를 채택하되, **역할별 로그인**을 결합한다. 사용자 확정 결정:

1. **역할별 로그인** — 관리자·스태프는 ID/PW 로그인, 뷰어는 버튼 입장. 역할에 따라 탭 노출이 다름.
2. **점수 = 수동 +/− 단위** — 게임은 라벨(이모지+이름), 점수는 입력 화면에서 단위(+1/+5/+10/+50/직접)를 골라 팀별 +/−.
3. **테마 = 청량 아쿠아 하나** (전환 기능 없음).

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

기존 `src/components/ui.tsx`의 `Screen/Blob/Content/Glass/Avatar` 구조는 재사용하되 `theme.ts`를 위 토큰으로 교체. 보라·핑크 TALLY 테마는 폐기.

---

## 2. 인증과 역할

| 역할(`role`) | 입장 | 접근 탭/화면 | 기능 |
|------|------|-------------|------|
| 뷰어 | 버튼(비로그인) | 순위 · 발표 모드 | 순위·점수 **열람만** |
| 스태프(`staff`) | ID/PW | 순위 · 입력 · 기록 | 모든 게임 **점수 부여**(+/−)·기록 취소 |
| 관리자(`admin`) | ID/PW | 순위 · 입력 · 기록 · 팀·게임 | 위 + **팀·게임 CRUD**, 전체 초기화 |

- 관리자·스태프 비밀번호는 **SHA-256 해시** 저장·비교. 로그인 성공 시 **세션 토큰을 localStorage에 저장**(새로고침 유지).
- `AuthContext` + 라우트 가드(`RequireRole`)로 접근 제어. `TabBar`는 역할에 따라 탭을 노출.
- 계정은 DB에 시드(예: `admin/1234`, `staff1/1111`). 앱 내 계정 관리 UI는 범위 밖.
- **게임별 스태프 배정 없음** — 스태프는 모든 게임에 입력 가능(새 디자인의 게임=라벨 단순화 반영).

---

## 3. 화면 구조 (로그인 → 하단 탭 네비 + 발표 모드)

라우팅 유지. 레이아웃 라우트가 하단 `TabBar`(역할별)를 렌더. 가드는 `RequireRole`.

| 경로 | 탭 | 접근 | 내용 |
|------|-----|------|------|
| `/login` | — | 공개 | ID/PW 로그인 + 게스트 버튼 |
| `/board` | 순위 | 전체 | 팀 순위(메달·이모지·막대·점수) + "발표 모드" 버튼 |
| `/input` | 입력 | staff·admin | 게임 칩 → 단위(+1/+5/+10/+50/직접) → 팀별 −/+ |
| `/log` | 기록 | staff·admin | 점수 기록 로그 + 개별 취소(void) |
| `/manage` | 팀·게임 | admin | 팀 CRUD(이모지·이름·색), 게임 CRUD(이모지·이름), 전체 초기화 |
| `/present` | (없음) | 전체 | 발표 모드 — 하단 탭 없는 전체화면 순위, 나가기 |
| `/` | — | — | 세션 없으면 `/login`, 있으면 `/board` |

`TabBar` 노출: 뷰어=순위 / 스태프=순위·입력·기록 / 관리자=순위·입력·기록·팀·게임. `/present`·`/login`엔 TabBar 없음.

---

## 4. 데이터 모델 (schema.sql 전면 교체)

### teams
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid pk | |
| name | text | |
| emoji | text | 팀 아바타 (예: '🦁') |
| color | text | 팔레트 색 (hex) |
| total_score | integer | 트리거 유지 |
| created_at | timestamptz | 정렬 |

### games
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid pk | |
| name | text | |
| emoji | text | 게임 아이콘 |
| created_at | timestamptz | 정렬 |

### users
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid pk | |
| name | text | |
| login_id | text unique | 로그인 아이디 |
| password_hash | text | SHA-256 hex |
| role | text | `admin`\|`staff` |
| created_at | timestamptz | |

### score_entries
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid pk | |
| team_id | uuid → teams(cascade) | not null |
| game_id | uuid → games(set null) | **nullable** |
| points | integer | 적용 증감(부호 포함) |
| created_by | uuid → users(set null) | 부여자(nullable) |
| created_at | timestamptz | |
| voided | boolean | 취소 |

### 트리거·기타
- `recalc_team_total(uuid)` + `score_entries` after insert/update/delete 트리거(비-void 합).
- Realtime: teams·games·score_entries.
- RLS: 개발용 전체 허용(운영 전 강화는 향후).
- 시드: teams 4팀(이모지·색), games 5개(몸으로 말해요/릴레이 달리기/스피드 퀴즈/보물찾기/장기자랑), users(`admin/1234`, `staff1/1111`). score_entries 없음. 비밀번호는 pgcrypto `encode(digest('...','sha256'),'hex')`.

---

## 5. 프론트엔드 구조

### 5.1 신규
| 파일 | 역할 |
|------|------|
| `src/lib/auth.ts` | SHA-256, 세션 저장/복원, 로그인 검증 |
| `src/lib/auth.hash.test.ts` / `auth.session.test.ts` | 단위 테스트 |
| `src/context/AuthContext.tsx` | 세션 컨텍스트/훅 |
| `src/components/RequireRole.tsx` | 역할 라우트 가드 |
| `src/components/TabBar.tsx` | 하단 탭(역할별) |
| `src/components/AppLayout.tsx` | Outlet + TabBar |
| `src/components/TeamRankRow.tsx` | 순위/발표용 팀 행 |
| `src/lib/api.ts` | addScore, voidEntry, 팀·게임 CRUD, resetAll |
| `src/lib/constants.ts` | 팀 색 팔레트·이모지 프리셋·점수 단위 |
| `src/hooks/useScoreEntries.ts` | 점수 기록 구독 |
| `src/pages/Input.tsx` · `Records.tsx` · `Manage.tsx` · `Present.tsx` | 각 화면 |

### 5.2 수정
| 파일 | 변경 |
|------|------|
| `src/styles/theme.ts` | 아쿠아 토큰 교체 |
| `src/styles/GlobalStyle.ts` · `index.html` | Pretendard 적용/CDN |
| `src/types/index.ts` | Team.emoji, Game(emoji), ScoreEntry(gameId nullable), User(loginId), ScoreMode 등 정리 |
| `src/hooks/useTeams.ts` · `useGames.ts` | emoji select 반영 |
| `src/pages/Login.tsx` | 아쿠아 테마 ID/PW + 게스트 |
| `src/pages/Scoreboard.tsx` | 순위 탭 재작성(발표 진입) |
| `src/App.tsx` | AuthProvider + 레이아웃/가드 라우트 |

### 5.3 제거
`src/pages/StaffScoring.tsx`, `src/pages/AdminConsole.tsx` (기존 목업/구버전).

### 5.4 인증 세부(Vitest)
- `sha256Hex`, `Session{userId,name,role:'admin'|'staff'|'viewer',token}`, `saveSession/loadSession/clearSession`, `viewerSession()`, `login(loginId,pw)`.
- 단위 테스트: 해시 벡터(`'1234'`→`03ac6742…`), 세션 라운드트립·손상 JSON→null.

---

## 6. 화면별 동작

- **순위 `/board`**: `useTeams` 총점 내림차순. 메달·이모지·진행 막대·좌측 팀색 엣지. "발표 모드"→`/present`. 로그아웃/나가기.
- **입력 `/input`**: 게임 칩 → 단위 칩(직접=숫자 입력) → 팀별 [−][+] → `addScore(teamId, gameId, ±unit, userId)`.
- **기록 `/log`**: 최신순 기록(팀·게임·±·시각·부여자), 취소=`voidEntry`. 빈 상태.
- **팀·게임 `/manage`**: 팀 추가/수정(이모지·이름·색)/삭제, 게임 추가/수정(이모지·이름)/삭제, `resetAll()`(전 score_entries 삭제→총점 0).
- **발표 `/present`**: 전체화면 순위, 실시간, 나가기.

---

## 7. 범위 밖 (향후)
- 게임별 스태프 배정, 앱 내 계정 관리, 테마 전환, 순위 변동 애니메이션·선두 축하, RLS 강화, 통계 리포트.

---

## 8. 검증 기준
- `npm run typecheck` / `npm run test` / `npm run build` 통과.
- 관리자 로그인→전체 탭, 스태프→순위·입력·기록, 뷰어 버튼→순위·발표만(입력/관리 라우트 차단).
- 입력에서 단위 선택 후 +/− → 순위 총점 즉시 반영, 기록에 남고 취소 시 복원.
- 발표 모드 전체화면·실시간. 전체 초기화 시 총점 0. 새로고침 후 세션 유지.
