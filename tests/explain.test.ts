import { describe, expect, it } from "vitest";
import { explainMarketReading, whySummary } from "@/services/explain";

describe("explainMarketReading", () => {
  it("says why weak momentum was assigned from the recovery rule, not news", () => {
    const e = explainMarketReading({
      kind: "INDEX",
      name: "NIFTY MEDIA",
      signal: "WEAK_MOMENTUM",
      classification: "WEAK",
      return1m: -2.4,
      return1y: -11.2,
      priceVs200: -6.1,
      rs1y: -14,
      drawdown: 28,
      recovery: 31,
    });
    expect(e.because[0]).toMatch(/recovery score is below 45/i);
    expect(e.because[0]).toMatch(/28%/);
    expect(e.because.some((b) => /1-year return is negative/i.test(b))).toBe(true);
    expect(e.because.join(" ")).not.toMatch(/fund research class/i);
    expect(e.news).toEqual([]);
    expect(e.newsNote).toMatch(/do not invent/i);
  });

  it("says why improving was assigned and still flags the unfinished drawdown", () => {
    const e = explainMarketReading({
      kind: "INDEX",
      name: "NIFTY REALTY",
      signal: "IMPROVING",
      return1m: 4.2,
      return3m: 6.1,
      return1y: -3.4,
      priceVs50: 1.8,
      drawdown: 22,
      recovery: 52,
    });
    expect(e.because[0]).toMatch(/recovery score is at least 45/i);
    expect(e.because.some((b) => /1-month return is positive/i.test(b))).toBe(true);
    expect(e.against.some((b) => /22% below/i.test(b))).toBe(true);
    expect(e.against.some((b) => /one-year tape is still negative/i.test(b))).toBe(true);
  });

  it("does not claim a rising month when Improving has a negative 1M", () => {
    const e = explainMarketReading({
      kind: "INDEX",
      name: "NIFTY MEDIA",
      signal: "IMPROVING",
      return1m: -2.4,
      drawdown: 58,
      recovery: 65,
    });
    expect(e.because.join(" ")).not.toMatch(/short window has turned/i);
    expect(e.against.some((b) => /not a rising month/i.test(b))).toBe(true);
  });

  it("uses mapped sector tape as the fund reason when holdings are missing", () => {
    const e = explainMarketReading({
      kind: "FUND",
      name: "Example IT Fund",
      signal: "WEAK",
      classification: "WEAK",
      category: "Sectoral/Thematic - IT",
      return1y: -8,
      overallScore: 38,
      sharpe: 0.21,
      related: [{ name: "NIFTY IT", weight: 100, signal: "WEAK_MOMENTUM", return1y: -9, drawdown: 24, source: "category" }],
    });
    expect(e.because.some((b) => /AMFI category mapping/i.test(b))).toBe(true);
    expect(e.because.some((b) => /NIFTY IT/i.test(b))).toBe(true);
    expect(e.because.some((b) => /weak momentum/i.test(b))).toBe(true);
  });

  it("summarises the first reasons for list cards", () => {
    const e = explainMarketReading({
      kind: "STOCK",
      name: "ABC",
      signal: "EARLY_RECOVERY",
      return1m: 3,
      drawdown: 34,
      recovery: 58,
    });
    const summary = whySummary(e);
    expect(summary).toMatch(/Early recovery/i);
    expect(summary.length).toBeGreaterThan(40);
  });
});
