// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// supabase 를 모킹해 조회 함수가 결정적 정렬(동률 tie-breaker 포함)을 거는지 검증한다.
// 시드 데이터는 한 insert 문으로 들어가 created_at 이 전부 같으므로,
// tie-breaker 가 없으면 행이 update 될 때마다 목록 순서가 뒤섞인다.
const orderCalls: Record<string, string[]> = {};

function makeBuilder(table: string) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.order = vi.fn((col: string) => {
    (orderCalls[table] ??= []).push(col);
    return chain;
  });
  chain.then = (res: (v: { data: unknown[]; error: null }) => void) => res({ data: [], error: null });
  return chain;
}

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

import { fetchGames, fetchTeams } from "@/lib/queries";

beforeEach(() => {
  for (const k of Object.keys(orderCalls)) delete orderCalls[k];
});

describe("fetchGames", () => {
  it("orders by created_at with id tie-breaker (동률 시 순서 고정)", async () => {
    await fetchGames();
    expect(orderCalls.games).toEqual(["created_at", "id"]);
  });
});

describe("fetchTeams", () => {
  it("orders by total_score, created_at with id tie-breaker", async () => {
    await fetchTeams();
    expect(orderCalls.teams).toEqual(["total_score", "created_at", "id"]);
  });
});
