// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// supabase 클라이언트를 모킹해 api 함수가 올바른 테이블/페이로드를 호출하는지,
// 에러를 표준 메시지로 던지는지 검증한다. (실제 네트워크 없음)
const calls: Record<string, unknown> = {};
let insertError: { message: string } | null = null;
let updateError: { message: string } | null = null;
let insertReturn: { id: string } | null = { id: "new-id" };

function makeBuilder(table: string) {
  const b: Record<string, unknown> = {};
  b.insert = vi.fn((payload: unknown) => {
    calls[`${table}.insert`] = payload;
    return {
      select: () => ({
        single: () => Promise.resolve({ data: insertReturn, error: insertError }),
      }),
      // audit_log.insert 는 select 없이 그대로 await
      then: (res: (v: { error: typeof insertError }) => void) => res({ error: insertError }),
    };
  });
  b.update = vi.fn((patch: unknown) => {
    calls[`${table}.update`] = patch;
    const chain = {
      eq: () => Promise.resolve({ error: updateError }),
      is: () => ({ select: () => Promise.resolve({ data: [{ id: "a" }], error: updateError }) }),
    };
    return chain;
  });
  b.delete = vi.fn(() => {
    calls[`${table}.delete`] = true;
    return { eq: () => Promise.resolve({ error: updateError }) };
  });
  return b;
}

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

import { addScore, voidEntry, setTeamActive, setGameActive, createTeam, createGame, resetAll } from "@/lib/api";

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
  insertError = null;
  updateError = null;
  insertReturn = { id: "new-id" };
});

describe("addScore", () => {
  it("inserts into score_entries with signed points and returns the id", async () => {
    const id = await addScore("t1", "g1", 10, "u1");
    expect(id).toBe("new-id");
    expect(calls["score_entries.insert"]).toEqual({
      team_id: "t1", game_id: "g1", points: 10, created_by: "u1", voided: false,
    });
  });
  it("supports negative points and null game/createdBy", async () => {
    await addScore("t1", null, -5, null);
    expect(calls["score_entries.insert"]).toMatchObject({ game_id: null, points: -5, created_by: null });
  });
  it("throws a Korean error when insert fails", async () => {
    insertError = { message: "boom" };
    await expect(addScore("t1", "g1", 10, "u1")).rejects.toThrow("점수를 저장하지 못했습니다.");
  });
});

describe("voidEntry", () => {
  it("marks the entry voided", async () => {
    await voidEntry("e1");
    expect(calls["score_entries.update"]).toEqual({ voided: true });
  });
  it("throws on failure", async () => {
    updateError = { message: "x" };
    await expect(voidEntry("e1")).rejects.toThrow("취소하지 못했습니다.");
  });
});

describe("setTeamActive / setGameActive", () => {
  it("updates teams.active", async () => {
    await setTeamActive("t1", false, "admin");
    expect(calls["teams.update"]).toEqual({ active: false });
  });
  it("updates games.active", async () => {
    await setGameActive("g1", true, "admin");
    expect(calls["games.update"]).toEqual({ active: true });
  });
});

describe("resetAll", () => {
  it("archives only un-archived entries and returns the count", async () => {
    const count = await resetAll("admin", "관리자");
    expect(count).toBe(1); // mock select() returns one row
    const patch = calls["score_entries.update"] as { archived_at?: string };
    expect(typeof patch.archived_at).toBe("string"); // 타임스탬프가 찍힘
  });
  it("writes a reset audit entry naming the actor", async () => {
    await resetAll("admin", "관리자");
    const audit = calls["audit_log.insert"] as { action: string; actor: string; detail: { by: string } };
    expect(audit.action).toBe("reset");
    expect(audit.actor).toBe("admin");
    expect(audit.detail.by).toBe("관리자");
  });
  it("throws a Korean error when the archive update fails", async () => {
    updateError = { message: "nope" };
    await expect(resetAll("admin", "관리자")).rejects.toThrow("초기화하지 못했습니다.");
  });
});

describe("createTeam / createGame", () => {
  it("inserts a team row", async () => {
    await createTeam("사자", "🦁", "#fb7185");
    expect(calls["teams.insert"]).toEqual({ name: "사자", emoji: "🦁", color: "#fb7185" });
  });
  it("inserts a game row", async () => {
    await createGame("퀴즈", "⚡");
    expect(calls["games.insert"]).toEqual({ name: "퀴즈", emoji: "⚡" });
  });
});
