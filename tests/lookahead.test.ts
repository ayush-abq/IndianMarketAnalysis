import { describe, expect, it } from "vitest";
import { calculateAth } from "@/calculations/ath";
import { calculateDrawdown } from "@/calculations/drawdown";
import { DRAWDOWN_THRESHOLDS } from "@/config/defaults";
import { computeForBars } from "@/services/metrics";
import { DEFAULT_SETTINGS } from "@/config/defaults";
import type { PriceBar } from "@/calculations/trading-days";

function make(n: number, start = 100): PriceBar[] {
  const out: PriceBar[] = [];
  const d = new Date("2018-01-01T00:00:00Z");
  let px = start;
  for (let i = 0; i < n; i++) {
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    out.push({ date: d.toISOString().slice(0, 10), close: px, high: px, open: px, low: px });
    px += i < n / 2 ? 1 : i === Math.floor(n / 2) ? 50 : -0.2;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

describe("Look-ahead bias", () => {
  it("historical ATH ignores later peaks", () => {
    const bars: PriceBar[] = [
      { date: "2019-01-02", close: 100, high: 100, open: 100, low: 100 },
      { date: "2020-03-23", close: 60, high: 60, open: 60, low: 60 },
      { date: "2024-01-02", close: 200, high: 200, open: 200, low: 200 },
    ];
    const throughCrash = bars.filter((b) => b.date <= "2020-03-23");
    expect(calculateAth(throughCrash)?.closingAth).toBe(100);
    expect(calculateAth(bars)?.closingAth).toBe(200);
    const ddThen = calculateDrawdown(throughCrash, DRAWDOWN_THRESHOLDS)!;
    expect(ddThen.distanceFromAthPercent).toBeCloseTo(40);
  });

  it("computeForBars as-of a past date does not see future closes", () => {
    const bars = make(800, 100);
    const asOf = bars[400].date;
    const computed = computeForBars(
      bars,
      asOf,
      DEFAULT_SETTINGS,
      { nifty50: null, nifty500: null, nifty50Mas: null },
      "Test Index",
    );
    expect(computed).not.toBeNull();
    expect(computed!.asOf <= asOf).toBe(true);
    expect(computed!.drawdown.athDate <= asOf).toBe(true);
  });
});
