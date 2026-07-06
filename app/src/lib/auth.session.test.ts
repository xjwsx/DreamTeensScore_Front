// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { saveSession, loadSession, clearSession, viewerSession, type Session } from "@/lib/auth";

const sample: Session = { userId: "u1", name: "스태프", role: "staff", token: "t" };

describe("session storage", () => {
  beforeEach(() => localStorage.clear());
  it("round-trips", () => { saveSession(sample); expect(loadSession()).toEqual(sample); });
  it("null when empty", () => { expect(loadSession()).toBeNull(); });
  it("null on corrupt json", () => { localStorage.setItem("dtscore.session", "x"); expect(loadSession()).toBeNull(); });
  it("clear removes", () => { saveSession(sample); clearSession(); expect(loadSession()).toBeNull(); });
  it("viewerSession role", () => { expect(viewerSession().role).toBe("viewer"); });
});
