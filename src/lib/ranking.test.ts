import { describe, it, expect } from "vitest";
import { rankTeams } from "@/lib/ranking";
import type { Team } from "@/types";

const team = (id: string, totalScore: number): Team => ({
  id, name: id, emoji: "🦁", color: "#fff", totalScore, active: true, currentGameId: null,
});

describe("rankTeams", () => {
  it("동점이 없으면 순차 등수(1-2-3), tied=false", () => {
    const r = rankTeams([team("a", 30), team("b", 20), team("c", 10)]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3]);
    expect(r.map((x) => x.tied)).toEqual([false, false, false]);
  });

  it("공동 2위면 다음은 4위로 건너뛴다(1-2-2-4)", () => {
    const r = rankTeams([team("a", 30), team("b", 20), team("c", 20), team("d", 10)]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 2, 4]);
    expect(r.map((x) => x.tied)).toEqual([false, true, true, false]);
  });

  it("공동 1위(1-1-3)", () => {
    const r = rankTeams([team("a", 30), team("b", 30), team("c", 10)]);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3]);
    expect(r.map((x) => x.tied)).toEqual([true, true, false]);
  });

  it("세 팀 공동 2위면 다음은 5위(1-2-2-2-5)", () => {
    const r = rankTeams([team("a", 30), team("b", 20), team("c", 20), team("d", 20), team("e", 10)]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 2, 2, 5]);
  });

  it("전원 동점이면 모두 공동 1위", () => {
    const r = rankTeams([team("a", 0), team("b", 0), team("c", 0)]);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 1]);
    expect(r.every((x) => x.tied)).toBe(true);
  });

  it("빈 목록", () => {
    expect(rankTeams([])).toEqual([]);
  });
});
