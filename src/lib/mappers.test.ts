import { describe, it, expect } from "vitest";
import { toTeam, toGame, toScoreEntry } from "@/lib/mappers";
import type { TeamRow, GameRow, ScoreEntryRow } from "@/lib/database.types";

describe("toTeam", () => {
  const row: TeamRow = {
    id: "t1", name: "1팀", emoji: "🦁", color: "#fb7185",
    total_score: 30, active: true, current_game_id: null, created_at: "2026-07-07T00:00:00Z",
  };
  it("maps snake_case → camelCase", () => {
    expect(toTeam(row)).toEqual({ id: "t1", name: "1팀", emoji: "🦁", color: "#fb7185", totalScore: 30, active: true, currentGameId: null });
  });
  it("carries the active flag through", () => {
    expect(toTeam({ ...row, active: false }).active).toBe(false);
  });
  it("maps current_game_id → currentGameId (배치된 팀)", () => {
    expect(toTeam({ ...row, current_game_id: "g9" }).currentGameId).toBe("g9");
  });
});

describe("toGame", () => {
  const row: GameRow = { id: "g1", name: "보물찾기", emoji: "🗺️", active: true, floor: 1, created_at: "2026-07-07T00:00:00Z" };
  it("maps id/name/emoji/active/floor", () => {
    expect(toGame(row)).toEqual({ id: "g1", name: "보물찾기", emoji: "🗺️", active: true, floor: 1 });
  });
  it("maps floor 2 (2층 게임)", () => {
    expect(toGame({ ...row, floor: 2 }).floor).toBe(2);
  });
  it("defaults floor to 1 when the column is missing (004 마이그레이션 전 DB)", () => {
    expect(toGame({ ...row, floor: undefined as unknown as number }).floor).toBe(1);
  });
});

describe("toScoreEntry", () => {
  const row: ScoreEntryRow = {
    id: "e1", team_id: "t1", game_id: "g1", points: 10,
    created_by: "u1", created_at: "2026-07-07T00:00:00Z", voided: false, archived_at: null,
  };
  it("maps all fields to camelCase", () => {
    expect(toScoreEntry(row)).toEqual({
      id: "e1", teamId: "t1", gameId: "g1", points: 10,
      createdBy: "u1", createdAt: "2026-07-07T00:00:00Z", voided: false, archivedAt: null,
    });
  });
  it("preserves null gameId/createdBy/archivedAt", () => {
    const mapped = toScoreEntry({ ...row, game_id: null, created_by: null, archived_at: "2026-07-07T01:00:00Z" });
    expect(mapped.gameId).toBeNull();
    expect(mapped.createdBy).toBeNull();
    expect(mapped.archivedAt).toBe("2026-07-07T01:00:00Z");
  });
  it("keeps negative points (penalties)", () => {
    expect(toScoreEntry({ ...row, points: -10 }).points).toBe(-10);
  });
});
