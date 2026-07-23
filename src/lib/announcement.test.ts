import { describe, it, expect } from "vitest";
import { parseAnnouncement, shouldShowAnnouncement, formatRemaining } from "@/lib/announcement";
import type { Setting } from "@/types";

describe("parseAnnouncement", () => {
  it("parses a well-formed announcement row (기한 없음 → deadline null)", () => {
    const rows: Setting[] = [{ key: "announcement", value: { id: "a1", message: "30분 남음" } }];
    expect(parseAnnouncement(rows)).toEqual({ id: "a1", message: "30분 남음", deadline: null });
  });
  it("parses a numeric deadline", () => {
    const rows: Setting[] = [{ key: "announcement", value: { id: "a1", message: "종료까지", deadline: 1700000000000 } }];
    expect(parseAnnouncement(rows)).toEqual({ id: "a1", message: "종료까지", deadline: 1700000000000 });
  });
  it("treats a non-numeric deadline as null", () => {
    const rows: Setting[] = [{ key: "announcement", value: { id: "a1", message: "x", deadline: "soon" } }];
    expect(parseAnnouncement(rows)).toEqual({ id: "a1", message: "x", deadline: null });
  });
  it("returns null when the row is missing", () => {
    expect(parseAnnouncement([{ key: "hide_scores", value: true }])).toBeNull();
  });
  it("returns null when the value shape is wrong", () => {
    expect(parseAnnouncement([{ key: "announcement", value: { id: 1 } }])).toBeNull();
    expect(parseAnnouncement([{ key: "announcement", value: null }])).toBeNull();
  });
});

describe("formatRemaining", () => {
  it("formats mm:ss from remaining milliseconds", () => {
    expect(formatRemaining(20 * 60_000)).toBe("20:00");
    expect(formatRemaining(19 * 60_000 + 47_000)).toBe("19:47");
    expect(formatRemaining(5_000)).toBe("00:05");
  });
  it("rounds up partial seconds so the last second shows 00:01 not 00:00", () => {
    expect(formatRemaining(500)).toBe("00:01");
  });
  it("clamps to 00:00 at or past the deadline", () => {
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(-5000)).toBe("00:00");
  });
});

describe("shouldShowAnnouncement", () => {
  const a = { id: "a1", message: "곧 시작", deadline: null };
  it("shows a new non-empty announcement", () => {
    expect(shouldShowAnnouncement(null, a)).toBe(true);
    expect(shouldShowAnnouncement("a0", a)).toBe(true);
  });
  it("does not re-show the same id", () => {
    expect(shouldShowAnnouncement("a1", a)).toBe(false);
  });
  it("does not show empty id or empty message or null", () => {
    expect(shouldShowAnnouncement(null, { id: "", message: "x", deadline: null })).toBe(false);
    expect(shouldShowAnnouncement(null, { id: "a1", message: "", deadline: null })).toBe(false);
    expect(shouldShowAnnouncement(null, null)).toBe(false);
  });
});
