# 게임 방(위치) 이름 — 설계 문서

**작성일:** 2026-07-23
**대상:** 게임 부스가 어느 방인지(예: 201호, 소예배실) 맵에서 바로 보이게
**한 줄 요약:** 게임마다 자유 텍스트 위치(방 이름)를 입력하고, 맵의 게임 이름 옆에 작게 표시한다.

---

## 1. 확정된 결정 (브레인스토밍)

| 항목 | 결정 |
|------|------|
| 데이터 | `games.room text not null default ''` — 빈 문자열 = 미입력(표시 안 함) |
| 입력 위치 | 관리 페이지 게임 카드 **둘째 줄** 입력칸 (첫 줄이 꽉 차 있음), blur 저장 |
| 표시 | 맵 게임 카드의 이름 옆 + 팀 이동 시트의 게임 이름 옆, 작고 흐린 텍스트 |
| 추가 흐름 | 지금처럼 원탭 생성 후 카드에서 입력 (층 기능과 동일 결) |

## 2. 변경 내용

### 마이그레이션 `supabase/migrations/007_game_room.sql`

```sql
alter table public.games
  add column if not exists room text not null default '';
```

RLS·RPC 변경 없음 (games 쓰기는 기존 관리자 정책 그대로).

### 타입·매퍼·API

- `database.types.ts` — `games` Row 에 `room: string`, Insert/Update 에 `room?: string`.
- `types/index.ts` — `Game.room: string`.
- `mappers.ts` — `room: r.room ?? ""` (007 마이그레이션 전 DB 방어 — floor 와 동일 패턴).
- `api.ts` — `updateGame` patch 에 `room` 추가.

### 관리 — `Manage.tsx`

게임 카드 Row 아래 둘째 줄에 위치 입력칸(placeholder "위치 (예: 201호, 소예배실)"), 이름과 같은 blur 저장.

### 맵 — `Map.tsx`

- 게임 카드 헤더: `🎯 다트  201호   1/2팀 [종료]` — 이름 옆 작고 흐린 텍스트, 빈 값이면 생략.
- 팀 이동 시트 항목에도 동일 표시.

## 3. 테스트

`mappers.test.ts` — `toGame` 이 `room` 을 매핑하는지, 컬럼 없으면 `""` 인지.

## 4. 스코프에서 제외 (YAGNI)

- 방 이름 목록 관리(자동완성·중복 검사).
- 순위·입력·기록 페이지 표시.

## 5. 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `supabase/migrations/007_game_room.sql` | 신규 — `games.room` |
| `src/lib/database.types.ts` · `src/types/index.ts` · `src/lib/mappers.ts` · `src/lib/api.ts` | room 반영 |
| `src/pages/Manage.tsx` | 게임 카드 둘째 줄 위치 입력 |
| `src/pages/Map.tsx` | 카드·시트에 방 이름 표시 |
| `src/lib/mappers.test.ts` | room 매핑 테스트 |
