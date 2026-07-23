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
