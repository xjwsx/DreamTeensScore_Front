# 브로드캐스트 알람(관리자 모달 알림) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** admin이 전용 탭에서 문구를 보내면, 접속 중인 모든 계정(staff·게스트·발표 모드)의 화면에 모달이 떴다가 3.5초 후 자동으로 사라진다.

**Architecture:** 기존 `settings` 키-값 테이블 + `useRealtimeList` 실시간 구독 패턴을 재사용한다. `settings`에 `announcement` 행(`{id, message}`)을 두고 admin이 보낼 때마다 새 `id`를 쓴다. 수신 측은 화면에 붙어 있는 동안 **새로 도착한 `id`만** 모달로 띄운다 — 마운트 시점의 값은 "이미 본 것"으로 저장해 새로고침·뒤늦은 접속에는 뜨지 않는다.

**Tech Stack:** React + TypeScript(strict), styled-components, Supabase(Postgres + Realtime + RLS), Vitest.

## Global Constraints

- UI 문구·주석·커밋 메시지는 한글로 작성한다(기존 코드 관례).
- TypeScript strict — `any` 금지, jsonb 값은 사용처에서 좁힌다.
- 마이그레이션은 앱이 자동 실행하지 않는다. SQL 파일을 만들고 Supabase 대시보드 → SQL Editor(postgres 역할)에서 수동 적용한다(기존 마이그레이션 관례).
- 앱은 `settings` 행을 만들지 않고 **update만** 한다(행은 마이그레이션이 생성). 영향 행 0개는 에러로 알린다.
- 에러는 `fail(msg, error)`로 표준화된 한글 메시지를 던진다.
- 기존 파일 스타일(styled-components 컴포넌트 정의, `@/` 별칭 import)을 따른다.

---

## File Structure

- Create: `supabase/migrations/008_settings_announcement.sql` — `announcement` 설정 행.
- Modify: `src/lib/api.ts` — `sendAnnouncement(message)` 추가.
- Modify: `src/lib/api.test.ts` — `sendAnnouncement` 테스트.
- Create: `src/lib/announcement.ts` — `parseAnnouncement`, `shouldShowAnnouncement` 순수 헬퍼 + `Announcement` 타입.
- Create: `src/lib/announcement.test.ts` — 두 헬퍼 단위 테스트.
- Modify: `src/hooks/useSettings.ts` — `announcement` 파싱 반환.
- Create: `src/components/AnnouncementModal.tsx` — 수신 모달(자동 소멸).
- Modify: `src/components/AppLayout.tsx` — `<AnnouncementModal />` 마운트.
- Modify: `src/pages/Present.tsx` — `<AnnouncementModal />` 마운트.
- Create: `src/pages/Notify.tsx` — 발송 화면(프리셋 + 자유 입력).
- Modify: `src/components/TabBar.tsx` — admin 전용 `/notify` 탭.
- Modify: `src/App.tsx` — `/notify` 라우트.

---

## Task 1: 발송 API + 마이그레이션

**Files:**
- Create: `supabase/migrations/008_settings_announcement.sql`
- Modify: `src/lib/api.ts` (파일 끝, 156행 뒤)
- Test: `src/lib/api.test.ts`

**Interfaces:**
- Produces: `sendAnnouncement(message: string): Promise<void>` — `settings`의 `announcement` 행을 `{ id: crypto.randomUUID(), message }`로 update.

- [ ] **Step 1: 마이그레이션 파일 작성**

Create `supabase/migrations/008_settings_announcement.sql`:

```sql
-- ============================================================
-- 008_settings_announcement.sql — 브로드캐스트 알람 설정 행
-- 적용 순서: … → 006_settings_hide_scores.sql → 007_game_room.sql → 008
-- Supabase 대시보드 → SQL Editor(postgres 역할)에서 실행하세요.
-- settings 테이블/RLS/Realtime 은 006 에서 이미 만들어졌으므로 행만 추가한다.
-- ============================================================

-- announcement = { id, message }. admin 이 보낼 때마다 id 가 바뀌고,
-- 접속 중인 클라이언트는 새 id 를 감지해 모달을 띄운다(3.5초 후 자동 소멸).
insert into public.settings (key, value)
values ('announcement', '{"id":"","message":""}'::jsonb)
on conflict (key) do nothing;
```

- [ ] **Step 2: 실패 테스트 작성**

`src/lib/api.test.ts`에서 import 목록에 `sendAnnouncement`를 추가하고(56행), 파일 끝에 describe 블록 추가:

```ts
describe("sendAnnouncement", () => {
  it("updates the announcement row with a fresh id and the message", async () => {
    await sendAnnouncement("곧 시작합니다!");
    const patch = calls["settings.update"] as { value: { id: string; message: string } };
    expect(patch.value.message).toBe("곧 시작합니다!");
    expect(typeof patch.value.id).toBe("string");
    expect(patch.value.id.length).toBeGreaterThan(0);
    expect(calls["settings.update.eq"]).toEqual(["key", "announcement"]);
  });
  it("throws a Korean error on failure (마이그레이션 전 행 없음 포함)", async () => {
    updateError = { message: "boom" };
    await expect(sendAnnouncement("x")).rejects.toThrow("알람을 보내지 못했습니다.");
  });
});
```

Import 라인(56행)을 다음으로 교체:

```ts
import { addScore, voidEntry, setTeamActive, setGameActive, createTeam, createGame, resetAll, setTeamGame, clearGame, setHideScores, sendAnnouncement } from "@/lib/api";
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/lib/api.test.ts`
Expected: FAIL — `sendAnnouncement is not exported` / not a function.

- [ ] **Step 4: 최소 구현**

`src/lib/api.ts` 끝(156행 `setHideScores` 뒤)에 추가:

```ts
// 브로드캐스트 알람: announcement 행을 새 id + 메시지로 갱신한다.
// 접속 중인 클라이언트가 새 id 를 감지해 모달을 띄운다(수신 로직은 AnnouncementModal).
// setHideScores 처럼 .select() 로 영향 행을 확인해 마이그레이션 미적용(행 없음)을 에러로 알린다.
export async function sendAnnouncement(message: string): Promise<void> {
  const value = { id: crypto.randomUUID(), message };
  const { data, error } = await supabase
    .from("settings")
    .update({ value })
    .eq("key", "announcement")
    .select("key");
  if (error || !data?.length) fail("알람을 보내지 못했습니다.", error);
}
```

`Json` 타입 관련: `value`는 `{ id, message }` 객체라 `update({ value })`가 `Json` 요구를 만족한다(문자열 필드만). 타입 에러가 나면 `update({ value: value as unknown as Json })`가 아니라, 우선 그대로 두고 Step 6의 타입체크에서 확인한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/lib/api.test.ts`
Expected: PASS (기존 테스트 포함 전부 통과).

- [ ] **Step 6: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. `value` 관련 타입 에러가 나면 `announcement` 값 타입을 명시:
`const value: { id: string; message: string } = { id: crypto.randomUUID(), message };`

- [ ] **Step 7: 커밋**

```bash
git add supabase/migrations/008_settings_announcement.sql src/lib/api.ts src/lib/api.test.ts
git commit -m "feat(alert): 브로드캐스트 알람 발송 API + settings 마이그레이션"
```

---

## Task 2: 수신 헬퍼 + useSettings 확장

**Files:**
- Create: `src/lib/announcement.ts`
- Test: `src/lib/announcement.test.ts`
- Modify: `src/hooks/useSettings.ts`

**Interfaces:**
- Consumes: `Setting[]`(=`{ key: string; value: unknown }[]`) from `src/types`.
- Produces:
  - `interface Announcement { id: string; message: string }`
  - `parseAnnouncement(settings: Setting[]): Announcement | null` — `announcement` 행의 value를 좁혀 반환(형식 안 맞으면 null).
  - `shouldShowAnnouncement(prevId: string | null, next: Announcement | null): boolean`
  - `useSettings()` 반환에 `announcement: Announcement | null` 추가.

- [ ] **Step 1: 실패 테스트 작성**

Create `src/lib/announcement.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseAnnouncement, shouldShowAnnouncement } from "@/lib/announcement";
import type { Setting } from "@/types";

describe("parseAnnouncement", () => {
  it("parses a well-formed announcement row", () => {
    const rows: Setting[] = [{ key: "announcement", value: { id: "a1", message: "30분 남음" } }];
    expect(parseAnnouncement(rows)).toEqual({ id: "a1", message: "30분 남음" });
  });
  it("returns null when the row is missing", () => {
    expect(parseAnnouncement([{ key: "hide_scores", value: true }])).toBeNull();
  });
  it("returns null when the value shape is wrong", () => {
    expect(parseAnnouncement([{ key: "announcement", value: { id: 1 } }])).toBeNull();
    expect(parseAnnouncement([{ key: "announcement", value: null }])).toBeNull();
  });
});

describe("shouldShowAnnouncement", () => {
  const a = { id: "a1", message: "곧 시작" };
  it("shows a new non-empty announcement", () => {
    expect(shouldShowAnnouncement(null, a)).toBe(true);
    expect(shouldShowAnnouncement("a0", a)).toBe(true);
  });
  it("does not re-show the same id", () => {
    expect(shouldShowAnnouncement("a1", a)).toBe(false);
  });
  it("does not show empty id or empty message or null", () => {
    expect(shouldShowAnnouncement(null, { id: "", message: "x" })).toBe(false);
    expect(shouldShowAnnouncement(null, { id: "a1", message: "" })).toBe(false);
    expect(shouldShowAnnouncement(null, null)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/announcement.test.ts`
Expected: FAIL — `@/lib/announcement` 모듈 없음.

- [ ] **Step 3: 헬퍼 구현**

Create `src/lib/announcement.ts`:

```ts
import type { Setting } from "@/types";

export interface Announcement {
  id: string;
  message: string;
}

// settings 목록에서 announcement 행의 jsonb 값을 { id, message } 로 좁힌다.
// 행이 없거나 형식이 안 맞으면 null.
export function parseAnnouncement(settings: Setting[]): Announcement | null {
  const raw = settings.find((s) => s.key === "announcement")?.value;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const { id, message } = raw as Record<string, unknown>;
    if (typeof id === "string" && typeof message === "string") return { id, message };
  }
  return null;
}

// 화면에 붙어 있는 동안 "새로 도착한" 알람인지 판정한다.
// 빈 id/빈 메시지(초기값)나 직전에 이미 띄운 id 는 표시하지 않는다.
export function shouldShowAnnouncement(prevId: string | null, next: Announcement | null): boolean {
  return !!next && next.id !== "" && next.message !== "" && next.id !== prevId;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/announcement.test.ts`
Expected: PASS.

- [ ] **Step 5: useSettings 확장**

`src/hooks/useSettings.ts` 전체를 교체:

```ts
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { fetchSettings } from "@/lib/queries";
import { parseAnnouncement, type Announcement } from "@/lib/announcement";

// 전역 설정 실시간 훅. hide_scores 행이 없거나(마이그레이션 전) 로딩 전이면 false(공개).
// announcement 는 브로드캐스트 알람의 최신 값(없으면 null).
export function useSettings(): {
  hideScores: boolean;
  announcement: Announcement | null;
  loading: boolean;
} {
  const { data, loading } = useRealtimeList("settings", fetchSettings);
  const hideScores = data.find((s) => s.key === "hide_scores")?.value === true;
  const announcement = parseAnnouncement(data);
  return { hideScores, announcement, loading };
}
```

- [ ] **Step 6: 타입체크 + 전체 테스트**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 에러 없음, 전부 PASS. (기존 `useSettings` 사용처 Scoreboard/Present는 `hideScores`, `loading`만 구조분해하므로 영향 없음.)

- [ ] **Step 7: 커밋**

```bash
git add src/lib/announcement.ts src/lib/announcement.test.ts src/hooks/useSettings.ts
git commit -m "feat(alert): 알람 파싱·표시 판정 헬퍼 + useSettings 확장"
```

---

## Task 3: 수신 모달 컴포넌트 + 마운트

**Files:**
- Create: `src/components/AnnouncementModal.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/pages/Present.tsx`

**Interfaces:**
- Consumes: `useSettings()` → `{ announcement, loading }`; `shouldShowAnnouncement`.
- Produces: `<AnnouncementModal />` — props 없음. 스스로 구독·표시·자동 소멸.

- [ ] **Step 1: 모달 컴포넌트 구현**

Create `src/components/AnnouncementModal.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { BellRing } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { shouldShowAnnouncement } from "@/lib/announcement";

// 자동 소멸까지의 시간(ms). 짧게 떴다 사라지는 일시적 알람.
const AUTO_DISMISS_MS = 3500;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(6, 34, 44, 0.55);
  backdrop-filter: blur(2px);
`;
const Card = styled.div`
  width: 100%;
  max-width: 360px;
  padding: 30px 24px;
  text-align: center;
  color: #fff;
  border-radius: 24px;
  background: ${({ theme }) => theme.colors.screenGradient};
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4);
`;
const IconWrap = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
`;
const Msg = styled.div`
  font-size: 22px;
  font-weight: 800;
  line-height: 1.4;
  word-break: keep-all;
`;

/**
 * 브로드캐스트 알람 수신 모달. useSettings 의 announcement 를 구독하고,
 * 화면에 붙어 있는 동안 새로 도착한 id 만 띄운 뒤 AUTO_DISMISS_MS 후 자동으로 닫는다.
 * 마운트 시점의 값은 "이미 본 것"으로 저장해 새로고침·뒤늦은 접속에는 뜨지 않는다.
 * 백드롭/카드 탭하면 즉시 닫힌다. AppLayout·Present 에 각각 마운트(동시 렌더 없음).
 */
export function AnnouncementModal() {
  const { announcement, loading } = useSettings();
  const id = announcement?.id ?? "";
  const message = announcement?.message ?? "";

  const lastId = useRef<string | null>(null);
  const initialized = useRef(false);
  const timer = useRef<number>();
  const [shownMsg, setShownMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    // 첫 정착 로드: 현재 값을 "이미 본 것"으로 저장만 하고 띄우지 않는다.
    if (!initialized.current) {
      initialized.current = true;
      lastId.current = id;
      return;
    }
    const next = id === "" ? null : { id, message };
    if (shouldShowAnnouncement(lastId.current, next)) {
      lastId.current = id;
      setShownMsg(message);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setShownMsg(null), AUTO_DISMISS_MS);
    }
  }, [id, message, loading]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (shownMsg === null) return null;
  return (
    <Backdrop onClick={() => setShownMsg(null)}>
      <Card onClick={() => setShownMsg(null)}>
        <IconWrap><BellRing size={34} color="#fbbf24" /></IconWrap>
        <Msg>{shownMsg}</Msg>
      </Card>
    </Backdrop>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (`theme.colors.screenGradient`는 `ConfirmModal`이 이미 쓰는 토큰이라 존재함.)

- [ ] **Step 3: AppLayout 에 마운트**

`src/components/AppLayout.tsx`를 수정한다. import에 추가:

```tsx
import { AnnouncementModal } from "@/components/AnnouncementModal";
```

`<Content>` 블록 안, `<TabBar />` 바로 뒤에 추가(백드롭은 position:fixed라 위치 무관):

```tsx
        <Outlet />
        <TabSpacer />
        <TabBar />
        <AnnouncementModal />
      </Content>
```

- [ ] **Step 4: Present 에 마운트**

`src/pages/Present.tsx`를 수정한다. import에 추가:

```tsx
import { AnnouncementModal } from "@/components/AnnouncementModal";
```

`<Content $maxWidth="1040px">` … `</Content>` 내부의 맨 끝(닫는 `</Content>` 직전)에 `<AnnouncementModal />`를 추가한다. 예:

```tsx
        {/* …기존 순위 목록… */}
        <AnnouncementModal />
      </Content>
```

- [ ] **Step 5: 타입체크 + 전체 테스트**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 에러 없음, 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/components/AnnouncementModal.tsx src/components/AppLayout.tsx src/pages/Present.tsx
git commit -m "feat(alert): 알람 수신 모달 + AppLayout·Present 마운트"
```

---

## Task 4: 발송 화면(Notify) + 탭 + 라우트

**Files:**
- Create: `src/pages/Notify.tsx`
- Modify: `src/components/TabBar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `sendAnnouncement`(Task 1); `useToast`/`Toast`(기존).
- Produces: `/notify` 라우트(admin 전용), TabBar `알림` 탭.

- [ ] **Step 1: Notify 페이지 구현**

Create `src/pages/Notify.tsx`:

```tsx
import { useState } from "react";
import styled from "styled-components";
import { BellRing, Send } from "lucide-react";
import { sendAnnouncement } from "@/lib/api";
import { Toast, useToast } from "@/components/Toast";

const Title = styled.div` font-size: 26px; font-weight: 800; margin-bottom: 16px; `;
const Label = styled.div` font-size: 13px; font-weight: 700; color: rgba(255,255,255,.7); margin: 4px 0 8px; `;
const Presets = styled.div` display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 18px; `;
const Chip = styled.button`
  padding: 11px 16px; border-radius: 999px; font-size: 14px; font-weight: 700; white-space: nowrap;
  color: #fff; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28);
  transition: transform .12s ease; &:active { transform: scale(.95); }
`;
const Input = styled.textarea`
  width: 100%; min-height: 84px; resize: vertical; padding: 14px 16px; border-radius: 18px;
  font-size: 16px; font-weight: 600; line-height: 1.4; color: #0e7490; background: #fff; border: none;
`;
const SendBtn = styled.button`
  width: 100%; margin-top: 16px; padding: 16px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 16px; font-weight: 800; color: #0e7490; background: #fff;
  transition: opacity .12s ease, transform .12s ease;
  &:active { transform: scale(.98); }
  &:disabled { opacity: .5; }
`;

// 자주 쓰는 안내 문구. 탭하면 입력칸을 채운다.
const PRESETS = ["30분 남았습니다!", "10분 남았습니다!", "5분 남았습니다!", "곧 시작합니다!"];

export default function Notify() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast, notify } = useToast();

  const trimmed = message.trim();

  const send = async () => {
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendAnnouncement(trimmed);
      notify("알람을 보냈어요");
      setMessage("");
    } catch (e) {
      notify(e instanceof Error ? e.message : "알람을 보내지 못했습니다.", true);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Toast toast={toast} />
      <Title>알림 보내기</Title>
      <Label>자주 쓰는 문구</Label>
      <Presets>
        {PRESETS.map((p) => (
          <Chip key={p} onClick={() => setMessage(p)}>{p}</Chip>
        ))}
      </Presets>
      <Label>메시지</Label>
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="모든 화면에 띄울 문구를 입력하세요"
      />
      <SendBtn disabled={!trimmed || sending} onClick={() => void send()}>
        {sending ? <>보내는 중…</> : <><Send size={18} /> 보내기</>}
      </SendBtn>
      <Label style={{ marginTop: 14 }}>
        <BellRing size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
        접속 중인 모든 화면에 모달이 떴다가 잠시 후 자동으로 사라집니다.
      </Label>
    </>
  );
}
```

- [ ] **Step 2: TabBar 에 admin 전용 탭 추가**

`src/components/TabBar.tsx` 수정. import의 lucide 아이콘에 `BellRing` 추가(3행):

```tsx
import { Trophy, Plus, Clock, Settings, MapPin, BellRing } from "lucide-react";
```

`TABS` 배열 마지막 항목(`/manage`) 뒤에 추가(27행 뒤):

```tsx
  { to: "/manage", label: "팀·게임", icon: Settings, roles: ["admin"] },
  { to: "/notify", label: "알림", icon: BellRing, roles: ["admin"] },
```

- [ ] **Step 3: App 에 라우트 추가**

`src/App.tsx` 수정. import에 추가(13행 뒤):

```tsx
import Notify from "@/pages/Notify";
```

`/manage` Route 뒤(34행 뒤)에 추가:

```tsx
            <Route path="/manage" element={<RequireRole roles={["admin"]}><Manage /></RequireRole>} />
            <Route path="/notify" element={<RequireRole roles={["admin"]}><Notify /></RequireRole>} />
```

- [ ] **Step 4: 타입체크 + 빌드 + 전체 테스트**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: 에러 없음, 전부 PASS, 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/Notify.tsx src/components/TabBar.tsx src/App.tsx
git commit -m "feat(alert): 알림 발송 화면 + admin 탭·라우트"
```

---

## Task 5: 수동 확인 (마이그레이션 적용 후)

**Files:** 없음(운영 확인).

- [ ] **Step 1: 마이그레이션 적용**

Supabase 대시보드 → SQL Editor(postgres 역할)에서 `supabase/migrations/008_settings_announcement.sql` 내용을 실행한다.

- [ ] **Step 2: 실서비스 시나리오 확인**

- 브라우저 두 개(예: admin 로그인 A, staff/게스트 로그인 B)를 연다.
- A에서 `/notify` 탭 → 프리셋 `30분 남았습니다!` 탭 → 보내기.
- 기대: B의 화면에 모달이 즉시 뜨고 3.5초 후 자동으로 사라진다. A에는 "알람을 보냈어요" 토스트.
- B를 새로고침한다. 기대: 방금 보낸 알람이 **다시 뜨지 않는다**.
- B가 `/present`(발표 모드)일 때도 모달이 뜨는지 확인한다.
- 빈 메시지에서 보내기 버튼이 비활성인지 확인한다.

- [ ] **Step 3: 확인 결과 기록**

이상 있으면 systematic-debugging으로 원인 추적. 정상이면 완료.

---

## Self-Review

- **Spec coverage:** 자유 입력+프리셋(Task 4) / 모든 계정·게스트·발표모드 수신(Task 3 AppLayout·Present 마운트) / 3.5초 자동 소멸(Task 3 `AUTO_DISMISS_MS`) / 새로고침·뒤늦은 접속 미표시(Task 2·3 `initialized` + `shouldShowAnnouncement`) / admin 전용 새 탭(Task 4) / 데이터·RLS(Task 1) — 모두 태스크로 커버됨.
- **Placeholder scan:** 모든 코드 블록에 실제 내용 있음. TODO/TBD 없음.
- **Type consistency:** `Announcement { id, message }`, `parseAnnouncement`, `shouldShowAnnouncement`, `sendAnnouncement`, `AnnouncementModal` 시그니처가 태스크 간 일치. `useSettings`는 `{ hideScores, announcement, loading }` 반환으로 통일(기존 사용처는 `hideScores`/`loading`만 구조분해 → 무해).
