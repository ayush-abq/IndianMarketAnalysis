import { describe, expect, it } from "vitest";
import { sma } from "@/calculations/moving-averages";
import { drawdownScore } from "@/scoring/drawdown-score";
import { weaknessScore } from "@/scoring/weakness-score";
import { recoveryScore } from "@/scoring/recovery-score";
import { opportunityScore } from "@/scoring/opportunity-score";
import {
  detectEarlyRecovery,
  detectFallingKnife,
  detectStructuralWeakness,
  resolveSignal,
  type SignalInput,
} from "@/scoring/signals";
import { DEFAULT_SETTINGS, RETURN_THRESHOLDS, WEAKNESS_WEIGHTS } from "@/config/defaults";

const baseSignal: SignalInput = {
  distanceFromAth: 46,
  return1m: -12,
  return3m: -18,
  return1y: -32,
  return2y: -45,
  return5y: -18,
  priceVs200: -14,
  ma200Slope: -1.2,
  rs1m: -4,
  rs3m: -8,
  rs1y: -35,
  priceVs50: -6,
  crossed50: false,
  recoveryScore: 18,
  volPercentile: 85,
  return20d: -9,
  trendState: "STRONG_DOWNTREND",
};

describe("Moving averages", () => {
  it("computes SMA", () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(sma([1, 2], 5)).toBeNull();
  });
});

describe("Scores", () => {
  it("maps a 40% drawdown onto a high continuous score", () => {
    const s = drawdownScore(40);
    expect(s.continuous).toBeCloseTo((40 / 60) * 100);
    expect(s.blended).toBeGreaterThan(50);
  });

  it("scores 1Y <= -35 as 100 weakness", () => {
    const w = weaknessScore(
      { y1: -35, y2: -50, y5: -30 },
      RETURN_THRESHOLDS,
      WEAKNESS_WEIGHTS,
    );
    expect(w.y1).toBe(100);
    expect(w.y2).toBe(100);
    expect(w.y5).toBe(100);
    expect(w.weighted).toBe(100);
  });

  it("gives a higher recovery score when momentum and MAs improve", () => {
    const weak = recoveryScore(
      {
        recoveryFromTroughPct: 2,
        return5d: -3,
        return20d: -6,
        priceVs50: -8,
        priceVs200: -15,
        return3m: -12,
        return6m: -20,
        rs1m: -5,
        crossed50: false,
        crossed200: false,
        higherLow: false,
      },
      DEFAULT_SETTINGS.recovery_weights,
    );
    const improving = recoveryScore(
      {
        recoveryFromTroughPct: 18,
        return5d: 4,
        return20d: 6,
        priceVs50: 2,
        priceVs200: -4,
        return3m: 5,
        return6m: 8,
        rs1m: 3,
        crossed50: true,
        crossed200: false,
        higherLow: true,
      },
      DEFAULT_SETTINGS.recovery_weights,
    );
    expect(improving).toBeGreaterThan(weak);
    expect(improving).toBeGreaterThan(50);
  });

  it("builds an opportunity research score from components", () => {
    const score = opportunityScore(
      {
        drawdown: 80,
        weakness: 70,
        momentumReversal: 20,
        recovery: 18,
        relativeStrength: -30,
      },
      DEFAULT_SETTINGS.opportunity_weights,
    );
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("Detectors", () => {
  it("identifies a falling knife", () => {
    expect(detectFallingKnife(baseSignal, DEFAULT_SETTINGS.signal_thresholds)).toBe(true);
    expect(resolveSignal(baseSignal, DEFAULT_SETTINGS.signal_thresholds)).toBe("FALLING_KNIFE");
  });

  it("identifies early recovery", () => {
    const s: SignalInput = {
      ...baseSignal,
      return1m: 3,
      return20d: 4,
      return3m: 2,
      priceVs50: 1.2,
      crossed50: true,
      rs1m: 1,
      rs3m: -4,
      ma200Slope: -0.2,
      recoveryScore: 67,
      trendState: "SIDEWAYS",
    };
    expect(detectEarlyRecovery(s, DEFAULT_SETTINGS.signal_thresholds)).toBe(true);
    expect(resolveSignal(s, DEFAULT_SETTINGS.signal_thresholds)).toBe("EARLY_RECOVERY");
  });

  it("identifies structural weakness", () => {
    expect(detectStructuralWeakness(baseSignal)).toBe(true);
    const healthy = { ...baseSignal, return5y: 31, priceVs200: 4 };
    expect(detectStructuralWeakness(healthy)).toBe(false);
  });
});
