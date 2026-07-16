# 게임 층(1층/2층) 구분 — 설계 문서

**작성일:** 2026-07-16
**대상:** 게임 부스가 건물 1층·2층에 나뉘어 배치된 캠프 환경
**한 줄 요약:** 각 게임에 층(1 또는 2)을 지정하고, 맵 페이지에서 층별 섹션으로 나눠 보여준다.

---

## 1. 배경과 목표

게임 부스가 1층과 2층에 나뉘어 있는데, 현재 맵 페이지는 모든 게임을 한 그리드에 섞어 보여준다. 게임마다 층을 지정할 수 있게 하고, 맵에서 층별로 구분해 표시한다.

### 확정된 결정 (브레인스토밍)

| 항목 | 결정 |
|------|------|
| 층 개수 | **1층 / 2층** 고정 (2개) |
| 층 지정 방식 | 추가는 지금처럼 원탭(기본 1층 생성), **관리 페이지 게임 카드의 1층/2층 토글**로 변경 |
| 맵 표시 | **층별 섹션** — 한 화면에 "1층" / "2층" 섹션 제목 아래 게임 카드 배치 |
| 대기 카드 | 지금처럼 맨 위 전체 폭 유지 |
| 팀 이동 시트 | 층 라벨로 구분해 게임 나열, 맨 아래 "대기" 유지 |

---

## 2. 데이터 모델

`games` 테이블에 컬럼 하나를 추가한다.

### 마이그레이션 `supabase/migrations/004_game_floor.sql`

```sql
-- 004_game_floor.sql — 게임 층(1층/2층)
-- 적용 순서: schema.sql → 001 → 002 → 003 → 004_game_floor.sql
-- Supabase 대시보드 → SQL Editor(postgres 역할)에서 실행하세요.

-- floor = 게임이 위치한 층. 기존 게임은 전부 1층으로 시작.
alter table public.games
  add column if not exists floor smallint not null default 1
  check (floor in (1, 2));
```

- 기존 게임은 전부 1층으로 생성되며, 관리 페이지 토글로 옮긴다.
- `games` 쓰기는 기존 RLS(관리자 전용 update) 그대로 — 새 정책·RPC 불필요.

### 타입 변경

- `src/lib/database.types.ts` — `games` 의 `Row` 에 `floor: number`, `Insert`/`Update` 에 `floor?: number` 추가.
- `src/types/index.ts` — `Game` 에 `floor: number` 추가.
- `src/lib/mappers.ts` — `toGame` 에 `floor: r.floor` 추가.

---

## 3. 실시간

`games` 는 이미 `useGames` → `useRealtimeList("games", fetchGames)` 로 구독 중이고 `select("*")` 이므로 새 컬럼이 자동 포함된다. **새 구독·쿼리 로직 불필요.**

---

## 4. 쓰기 API

`src/lib/api.ts` 의 기존 `updateGame` patch 타입에 `floor` 만 추가한다.

```ts
export async function updateGame(id: string, patch: Partial<{ name: string; emoji: string; floor: number }>): Promise<void>
```

`createGame` 은 그대로 — DB 기본값으로 1층 생성.

---

## 5. 화면

### 관리 — `src/pages/Manage.tsx`

게임 카드의 Row 에 **1층/2층 세그먼트 토글** 추가(이름 입력칸과 활성 스위치 사이). 탭하면 `updateGame(id, { floor })`. 기존 인라인 수정 패턴(이모지 순환, 이름 blur 저장)과 동일하게 즉시 저장.

### 맵 — `src/pages/Map.tsx`

- 대기 카드(전체 폭)는 그대로 맨 위.
- 그 아래 `🏠 1층` 섹션 제목 → 1층 활성 게임 카드 그리드, `🏢 2층` 섹션 제목 → 2층 게임 카드 그리드.
- 해당 층에 활성 게임이 없으면 그 섹션(제목 포함)을 숨긴다.
- 팀 이동 바텀시트: 게임 목록을 1층/2층 그룹 라벨로 구분, 맨 아래 "대기(배치 안 함)" 유지.

---

## 6. 테스트

- `src/lib/mappers.test.ts` — `toGame` 이 `floor` 를 매핑하는지.

---

## 7. 스코프에서 제외 (YAGNI)

- 3층 이상 / 층 이름 자유 입력.
- 게임 추가 시 층 선택 UI(팝업·버튼 분리) — 토글로 충분.
- Input/Records/Scoreboard/Present 페이지의 층 표시 — 맵·관리에만 적용.
- 층별 팀 수 집계 등 통계.

---

## 8. 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `supabase/migrations/004_game_floor.sql` | 신규 — `games.floor` 컬럼 |
| `src/lib/database.types.ts` | `games` Row/Insert/Update 에 `floor` |
| `src/types/index.ts` | `Game.floor` 추가 |
| `src/lib/mappers.ts` | `toGame` 매핑 추가 |
| `src/lib/api.ts` | `updateGame` patch 에 `floor` |
| `src/pages/Manage.tsx` | 게임 카드에 1층/2층 토글 |
| `src/pages/Map.tsx` | 층별 섹션 + 시트 층 그룹 |
| `src/lib/mappers.test.ts` | `toGame` floor 테스트 |
