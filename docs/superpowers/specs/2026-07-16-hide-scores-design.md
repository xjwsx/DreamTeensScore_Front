# 스코어 가리기 — 설계 문서

**작성일:** 2026-07-16
**대상:** 순위 발표 전 서스펜스 연출 (마지막 2게임쯤 남았을 때)
**한 줄 요약:** 관리자가 순위판의 토글 버튼을 누르면 게스트(비로그인 viewer)의 순위판·발표 모드에서 순위가 숨겨지고 서스펜스 카드가 표시된다. 실시간 동기화.

---

## 1. 배경과 목표

순위 발표 시간이 있는데 게스트(학생·리더)가 순위판에서 미리 다 보면 재미가 없다. 관리자가 발표 전 적당한 시점에 버튼 하나로 게스트의 순위를 가리고, 발표 순간에 다시 공개한다.

### 확정된 결정 (브레인스토밍)

| 항목 | 결정 |
|------|------|
| 가림 대상 | **게스트(viewer)만** — 스태프는 입력·기록에서 어차피 점수를 보므로 순위판만 가려도 의미 없음 |
| 가림 화면 | **서스펜스 카드만** — 팀 목록 통째로 숨김(순서·막대 등 어떤 힌트도 없음) |
| 조작 | 순위판 헤더의 **admin 전용 토글 버튼** |
| 동기화 | DB 저장 + Supabase Realtime — 누르는 즉시 모든 게스트 화면에 반영 |

---

## 2. 데이터 모델 — 마이그레이션 `006_settings_hide_scores.sql`

범용 키-값 `settings` 테이블 (다른 전역 설정도 담을 수 있게):

```sql
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value) values ('hide_scores', 'false'::jsonb)
on conflict (key) do nothing;

alter table public.settings enable row level security;
-- 읽기 공개(게스트가 봐야 함), 쓰기 admin 전용
create policy "settings read public"  on public.settings for select using (true);
create policy "settings update admin" on public.settings for update
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');
-- insert/delete 정책 없음 — 행은 마이그레이션이 만들고 앱은 update 만 한다

-- realtime publication 에 추가 (기존 테이블들과 동일 패턴)
```

`hide_scores` 행이 없거나 마이그레이션 전이면 클라이언트는 **false(공개)** 로 동작한다.

---

## 3. 클라이언트

### 타입 — `src/lib/database.types.ts`

`settings` 테이블 Row/Insert/Update (`key: string; value: Json; updated_at: string`).

### 조회 — `src/lib/queries.ts`

```ts
export async function fetchSettings(): Promise<Record<string, unknown>> // key → value 맵
```

### 쓰기 — `src/lib/api.ts`

```ts
export async function setHideScores(hidden: boolean): Promise<void>
// settings 의 hide_scores 행 update. 실패 시 "설정을 바꾸지 못했습니다."
```

### 훅 — `src/hooks/useSettings.ts`

`useRealtimeList("settings", ...)` 패턴 재사용. 반환: `{ hideScores: boolean, loading }`.
`value === true` 인 경우만 가림(그 외·행 없음·로딩 전 = 공개).

### 순위판 — `src/pages/Scoreboard.tsx`

- admin이면 헤더에 토글 Pill 추가: 공개 중엔 `👁 스코어 가리기`, 가림 중엔 `👁 스코어 공개`(가림 중임이 버튼 상태로 보임). 탭 → `setHideScores(!hideScores)` → 실패 시 토스트.
- `role === "viewer" && hideScores` 면 팀 목록 대신 서스펜스 카드:
  🤫 / "순위는 비밀이에요!" / "발표 시간에 공개됩니다". 기존 `Empty`(Glass) 스타일 계열.
- admin·staff 는 항상 목록 표시.

### 발표 모드 — `src/pages/Present.tsx`

같은 조건(`viewer && hideScores`)이면 목록 대신 큰 서스펜스 화면. 프로젝터가 admin/staff 세션이면 평소대로 보이므로 발표 진행에 지장 없음.

---

## 4. 한계 (의도된 범위)

점수 데이터의 읽기 RLS는 공개 그대로다 — 개발자 도구를 아는 사람은 네트워크 응답에서 점수를 볼 수 있다. 화면 가림용이지 보안 장치가 아니며, 캠프 용도로 충분하다고 판단(RLS 강화는 스코프 밖).

---

## 5. 테스트

- `src/lib/api.test.ts` — `setHideScores` 가 settings 를 올바른 페이로드로 update 하는지, 실패 시 한글 에러인지.
- `src/lib/queries.test.ts` — `fetchSettings` 가 key→value 맵을 만드는지.

---

## 6. 스코프에서 제외 (YAGNI)

- 점수 읽기 RLS 강화(진짜 숨김).
- 예약 공개(타이머), 부분 공개(하위권만) 등 연출 기능.
- 스태프 대상 가림.
- 관리 페이지의 별도 설정 섹션 — 순위판 버튼으로 충분.

---

## 7. 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `supabase/migrations/006_settings_hide_scores.sql` | 신규 — settings 테이블 + hide_scores 행 + RLS + realtime |
| `src/lib/database.types.ts` | `settings` 테이블 타입 |
| `src/lib/queries.ts` | `fetchSettings` |
| `src/lib/api.ts` | `setHideScores` |
| `src/hooks/useSettings.ts` | 신규 — `hideScores` 실시간 훅 |
| `src/pages/Scoreboard.tsx` | admin 토글 버튼 + viewer 서스펜스 카드 |
| `src/pages/Present.tsx` | viewer 서스펜스 화면 |
| `src/lib/api.test.ts`, `src/lib/queries.test.ts` | 테스트 |
