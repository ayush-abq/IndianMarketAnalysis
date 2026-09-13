import { describe, expect, it } from "vitest";
import { applyRoundTripCost, assertSignalDoesNotUseFillBar, entryIndex, nextSessionForward } from "@/calculations/execution";
import { expectedValue, evidenceStrength } from "@/scoring/expected-value";
import { recoveryStage, falseRecoveryRisk, fallenAngelScore } from "@/scoring/recovery-stage";
import { aggressiveAlphaScore, confluenceScore, netAggressiveScore, passesModeGates } from "@/scoring/confluence";
import type { PriceBar } from "@/calculations/trading-days";

function bars(): PriceBar[] {
  return [
    { date: "2020-03-20", close: 100 },
    { date: "2020-03-23", close: 80 },
    { date: "2020-03-24", close: 82 },
    { date: "2020-03-25", close: 90 },
  ];
}

describe("Next-session execution", () => {
  it("does not fill on the signal close", () => {
    const b = bars();
    expect(entryIndex(b, "2020-03-23", "NEXT_SESSION")).toBe(2);
    expect(b[2].date).toBe("2020-03-24");
    const fill = nextSessionForward(b, "2020-03-23", 1, "NEXT_SESSION");
    expect(fill?.entryDate).toBe("2020-03-24");
    expect(fill?.exitDate).toBe("2020-03-25");
    expect(fill!.entryDate > "2020-03-23").toBe(true);
    expect(() => assertSignalDoesNotUseFillBar("2020-03-23", "2020-03-23", "NEXT_SESSION")).toThrow(/leakage/);
  });

  it("deducts round-trip costs from gross", () => {
    expect(applyRoundTripCost(10, 40)).toBeCloseTo(9.6);
  });
});

describe("Expected value and evidence", () => {
  it("computes historical EV from wins and losses", () => {
    const ev = expectedValue([10, 10, -5]);
    expect(ev.sample).toBe(3);
    expect(ev.pGain).toBeCloseTo(200 / 3);
    expect(ev.expectedReturn).toBeCloseTo((2 / 3) * 10 - (1 / 3) * 5);
    expect(ev.note).toMatch(/insufficient/i);
  });

  it("does not call 7 observations strong evidence", () => {
    expect(evidenceStrength({ sample: 7, winRate: 90 }).level).toBe("Very Weak");
    expect(evidenceStrength({ sample: 50, winRate: 60, oosSample: 20, oosWinRate: 58 }).level).toMatch(/Strong|Moderate/);
  });
});

describe("Recovery / traps / aggressive score", () => {
  it("labels collapse vs early recovery", () => {
    expect(recoveryStage({ drawdown: 50, return1m: -12, return3m: -20, vs200: -15, recovery: 20, rs: -10 })).toBe(0);
    expect(recoveryStage({ drawdown: 35, return1m: 1, return3m: -4, vs200: -1, recovery: 60, rs: 2 })).toBe(3);
  });

  it("flags false recovery when price bounces without fundamentals", () => {
    const r = falseRecoveryRisk({
      return1m: 6,
      recovery: 30,
      vs200: -12,
      earnings: 20,
      quality: 25,
      rs: -5,
    });
    expect(r.flag).toBe(true);
  });

  it("does not treat cheap+bad as a fallen-angel opportunity", () => {
    const s = fallenAngelScore({ drawdown: 40, quality: 20, earnings: 15, recovery: 20, vs200: -10 });
    expect(s).not.toBeNull();
    expect(s!).toBeLessThan(40);
  });

  it("omits missing confluence weights and shows risk penalty", () => {
    const c = confluenceScore({ recovery: 70, valuation: null, fundamentals: null });
    expect(c.score).toBeCloseTo(70);
    expect(c.missing).toContain("valuation");
    const a = aggressiveAlphaScore({ upside: 50, recovery: 60 });
    const net = netAggressiveScore(a.score, 40);
    expect(net.net).not.toBeNull();
    expect(net.net!).toBeLessThan(a.score!);
  });

  it("aggressive mode still excludes falling knives", () => {
    expect(
      passesModeGates("AGGRESSIVE", {
        drawdown: 45,
        recovery: 50,
        classification: "FALLING_KNIFE",
        dataQuality: 80,
      }),
    ).toBe(false);
  });
});
