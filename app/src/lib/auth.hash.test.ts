// @vitest-environment node
import { describe, it, expect } from "vitest";
import { sha256Hex } from "@/lib/auth";

describe("sha256Hex", () => {
  it("known vector for '1234'", async () => {
    expect(await sha256Hex("1234")).toBe(
      "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"
    );
  });
  it("returns 64-char lowercase hex", async () => {
    expect(await sha256Hex("hello")).toMatch(/^[0-9a-f]{64}$/);
  });
});
