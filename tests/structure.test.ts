import { describe, expect, it } from "vitest";
import { analyzeStructure, priorWindowHigh, rangeCompression } from "@/calculations/structure";
import type { PriceBar } from "@/calculations/trading-days";

function series(closes: number[]): PriceBar[] {
  return closes.map((c, i) => ({
    date: new Date(Date.UTC(2025, 9, 1 + i)).toISOString().slice(0, 10),
    open: c,
    high: c + 0.5,
    low: c - 0.5,
    close: c,
    volume: 1000 + i * 10,
  }));
}

describe("chart structure", () => {
  it("does not invent a setup with a flat 20-bar tape", () => {
    const bars = series(Array.from({ length: 25 }, () => 100));
    const s = analyzeStructure(bars);
    expect(s?.label).toBe("NO_SETUP");
  });

  it("flags a fresh 20-session high break", () => {
    const base = Array.from({ length: 20 }, (_, i) => 100 + (i % 3));
    const bars = series([...base, 110]);
    expect(priorWindowHigh(bars, 20)).toBeLessThan(110);
    const s = analyzeStructure(bars);
    expect(s?.brokeOutToday).toBe(true);
    expect(s?.label).toBe("FRESH_BREAKOUT");
  });

  it("labels a coil when price sits just under a 20-session high after a tight range", () => {
    const climb = Array.from({ length: 40 }, (_, i) => 80 + i * 0.4);
    const tight = Array.from({ length: 20 }, () => 96);
    const bars = series([...climb, ...tight, 95.5]);
    expect(rangeCompression(bars)).not.toBeNull();
    const s = analyzeStructure(bars);
    expect(s).not.toBeNull();
    expect(["COILED", "NO_SETUP", "TREND_CONTINUATION"]).toContain(s!.label);
    if (s!.label === "COILED") {
      expect(s!.distanceTo20HighPct).toBeGreaterThan(0);
      expect(s!.distanceTo20HighPct).toBeLessThanOrEqual(2);
    }
  });

  it("marks a failed break when the close gives back the 20-session high", () => {
    const base = Array.from({ length: 20 }, () => 100);
    const bars = series([...base, 106, 106, 99]);
    const s = analyzeStructure(bars);
    expect(s?.label).toBe("FAILED_BREAKOUT");
  });
});
