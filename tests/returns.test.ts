import { describe, expect, it } from "vitest";
import { calculateReturns, periodReturn } from "@/calculations/returns";
import { relativePerformance } from "@/calculations/relative-strength";
import type { PriceBar } from "@/calculations/trading-days";

function sequential(n: number, start = 100, step = 1): PriceBar[] {
  const out: PriceBar[] = [];
  const d = new Date("2015-01-01T00:00:00Z");
  let price = start;
  for (let i = 0; i < n; i++) {
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    out.push({ date: d.toISOString().slice(0, 10), close: price, open: price, high: price, low: price });
    price += step;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

describe("Returns", () => {
  it("computes 1Y return over 252 trading days", () => {
    const series = sequential(300, 100, 0);
    series[series.length - 1 - 252].close = 100;
    series[series.length - 1].close = 80;
    const r = calculateReturns(series);
    expect(r.y1).toBeCloseTo(-20);
  });

  it("computes 2Y return over 504 trading days", () => {
    const series = sequential(600, 100, 0);
    series[series.length - 1 - 504].close = 200;
    series[series.length - 1].close = 100;
    const r = calculateReturns(series);
    expect(r.y2).toBeCloseTo(-50);
  });

  it("returns null (insufficient history) for 5Y when only 2 years exist", () => {
    const series = sequential(505, 100, 1);
    const r = calculateReturns(series);
    expect(r.y5).toBeNull();
    expect(r.y2).not.toBeNull();
  });

  it("never reports 0% when history is missing", () => {
    const series = sequential(10, 100, 1);
    const r = calculateReturns(series);
    expect(r.y1).toBeNull();
    expect(r.y2).toBeNull();
    expect(r.y5).toBeNull();
  });

  it("computes since-inception from the first observation", () => {
    expect(periodReturn(150, 100)).toBeCloseTo(50);
    const series = sequential(30, 100, 0);
    series[0].close = 100;
    series[series.length - 1].close = 130;
    expect(calculateReturns(series).sinceInception).toBeCloseTo(30);
  });
});

describe("Relative strength", () => {
  it("is sector return minus benchmark return in percentage points", () => {
    expect(relativePerformance(-20, 10)).toBeCloseTo(-30);
    expect(relativePerformance(null, 10)).toBeNull();
  });
});
