import { describe, expect, it } from "vitest";
import { isConstructive, trendFromMoves } from "@/services/simple-picks";

describe("simple pick trend", () => {
  it("needs two agreeing positives to call UP", () => {
    expect(trendFromMoves({ m1: 4, y1: 12, vs200: 3 })).toBe("UP");
  });

  it("is MIXED when some windows are still down", () => {
    expect(trendFromMoves({ m1: 5, y1: -8, vs200: 1 })).toBe("MIXED");
  });

  it("is DOWN when every known window is negative", () => {
    expect(trendFromMoves({ m1: -2, y1: -10, vs200: -4 })).toBe("DOWN");
  });

  it("is UNKNOWN when nothing is stored — never invents a trend", () => {
    expect(trendFromMoves({ m1: null, y1: null, vs200: null })).toBe("UNKNOWN");
  });

  it("rejects a bounce inside a deep crash", () => {
    expect(
      isConstructive({ trend: "MIXED", m1: 3, y1: -20, vs200: -15, drawdown: 55 }),
    ).toBe(false);
  });

  it("keeps a name that is up on the month and still above the 200DMA", () => {
    expect(
      isConstructive({ trend: "UP", m1: 4, y1: 11, vs200: 2, drawdown: 8 }),
    ).toBe(true);
  });
});
