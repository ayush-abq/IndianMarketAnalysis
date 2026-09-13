import { describe, expect, it } from "vitest";
import { calculateAth, pickAth } from "@/calculations/ath";
import { calculateDrawdown } from "@/calculations/drawdown";
import { DRAWDOWN_THRESHOLDS } from "@/config/defaults";
import type { PriceBar } from "@/calculations/trading-days";

function bars(closes: { date: string; close: number; high?: number }[]): PriceBar[] {
  return closes.map((c) => ({
    date: c.date,
    close: c.close,
    high: c.high ?? c.close,
    open: c.close,
    low: c.close,
  }));
}

describe("ATH calculation", () => {
  it("uses the maximum historical closing price and its date", () => {
    const series = bars([
      { date: "2020-01-02", close: 8000 },
      { date: "2021-01-04", close: 10000 },
      { date: "2022-01-03", close: 9000 },
      { date: "2024-01-02", close: 6000 },
    ]);
    const ath = calculateAth(series)!;
    expect(ath.closingAth).toBe(10000);
    expect(ath.closingAthDate).toBe("2021-01-04");
  });

  it("does not use future bars after as-of date", () => {
    const series = bars([
      { date: "2020-01-02", close: 8000 },
      { date: "2021-01-04", close: 9000 },
      { date: "2022-01-03", close: 12000 },
    ]);
    const through2021 = series.filter((b) => b.date <= "2021-06-01");
    const ath = calculateAth(through2021)!;
    expect(ath.closingAth).toBe(9000);
    expect(ath.closingAthDate).toBe("2021-01-04");
  });

  it("tracks a separate intraday ATH from highs", () => {
    const series = bars([
      { date: "2020-01-02", close: 100, high: 105 },
      { date: "2021-01-04", close: 110, high: 140 },
      { date: "2022-01-03", close: 120, high: 125 },
    ]);
    const ath = calculateAth(series)!;
    expect(ath.closingAth).toBe(120);
    expect(ath.intradayAth).toBe(140);
    expect(ath.intradayAthDate).toBe("2021-01-04");
    expect(pickAth(ath, "closing").value).toBe(120);
    expect(pickAth(ath, "intraday").value).toBe(140);
  });

  it("starts ATH from the earliest available observation for new indices", () => {
    const series = bars([{ date: "2024-06-03", close: 1000 }]);
    const ath = calculateAth(series)!;
    expect(ath.closingAth).toBe(1000);
    expect(ath.closingAthDate).toBe("2024-06-03");
  });

  it("returns null for empty history and never fabricates data", () => {
    expect(calculateAth([])).toBeNull();
  });
});

describe("Drawdown calculation", () => {
  it("computes 40% distance from ATH", () => {
    const series = bars([
      { date: "2021-01-04", close: 10000 },
      { date: "2024-01-02", close: 6000 },
    ]);
    const dd = calculateDrawdown(series, DRAWDOWN_THRESHOLDS)!;
    expect(dd.distanceFromAthPercent).toBeCloseTo(40);
    expect(dd.drawdownPercent).toBeCloseTo(-40);
    expect(dd.bucket).toBe("BEAR_MARKET");
  });

  it("classifies capitulation above 60%", () => {
    const series = bars([
      { date: "2021-01-04", close: 10000 },
      { date: "2024-01-02", close: 3500 },
    ]);
    const dd = calculateDrawdown(series, DRAWDOWN_THRESHOLDS)!;
    expect(dd.distanceFromAthPercent).toBeCloseTo(65);
    expect(dd.bucket).toBe("CAPITULATION_ZONE");
  });
});
