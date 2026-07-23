import { describe, it, expect } from "vitest";
import { TEAM_COLORS, TEAM_EMOJIS, GAME_EMOJIS, SCORE_UNITS } from "@/lib/constants";

describe("constants", () => {
  it("has 8 unique team colors as hex", () => {
    expect(TEAM_COLORS).toHaveLength(8);
    expect(new Set(TEAM_COLORS).size).toBe(8);
    for (const c of TEAM_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it("has unique, non-empty team emojis", () => {
    expect(TEAM_EMOJIS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(TEAM_EMOJIS).size).toBe(TEAM_EMOJIS.length);
  });
  it("has non-empty game emojis", () => {
    expect(GAME_EMOJIS.length).toBeGreaterThan(0);
  });
  it("score units are positive and ascending", () => {
    expect(SCORE_UNITS).toEqual([3, 5, 10]);
    for (const u of SCORE_UNITS) expect(u).toBeGreaterThan(0);
  });
});
