import { describe, it, expect } from "vitest";
import { emailForId } from "@/lib/auth";

describe("emailForId", () => {
  it("maps a login id to the pseudo-email", () => {
    expect(emailForId("admin")).toBe("admin@dreamteens.local");
  });
  it("trims and lowercases the id", () => {
    expect(emailForId("  Staff1 ")).toBe("staff1@dreamteens.local");
  });
});
