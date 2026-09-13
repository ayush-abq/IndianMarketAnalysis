import { describe, expect, it } from "vitest";
import { MAJOR_FUND_SLEEVES } from "@/config/major-funds";
import { pickFundForSleeve, pickMajorFunds } from "@/services/major-funds";
import type { MfRow } from "@/services/mf-queries";

function fund(name: string, extra: Partial<MfRow> = {}): MfRow {
  return {
    id: extra.id ?? Math.floor(Math.random() * 10_000),
    schemeName: name,
    amcName: null,
    schemeCode: "1",
    plan: "DIRECT",
    option: "GROWTH",
    assetClass: "Equity",
    category: "Small Cap",
    nav: 10,
    navDate: "2026-09-11",
    return1m: null,
    return3m: null,
    return6m: null,
    return1y: 12,
    cagr3y: 18,
    cagr5y: 20,
    cagr10y: null,
    return10y: null,
    sharpe: 0.8,
    sortino: null,
    maxDrawdown: -35,
    currentDrawdown: -8,
    expenseRatio: extra.expenseRatio ?? 0.4,
    aum: null,
    sip5y: null,
    sip10y: null,
    consistency: 60,
    overallScore: extra.overallScore ?? 70,
    classification: null,
    signal: null,
    researchNote: null,
    whyShort: "",
    ...extra,
  };
}

describe("major fund sleeves", () => {
  it("matches Bandhan Small Cap and HDFC Mid Cap official names", () => {
    const bandhan = MAJOR_FUND_SLEEVES.find((s) => s.id === "bandhan-small")!;
    const hdfcMid = MAJOR_FUND_SLEEVES.find((s) => s.id === "hdfc-mid")!;
    expect(bandhan.test("BANDHAN Small Cap Fund")).toBe(true);
    expect(hdfcMid.test("HDFC Mid Cap Fund")).toBe(true);
    expect(hdfcMid.test("HDFC Large & Mid Cap Fund")).toBe(false);
  });

  it("prefers UTI/HDFC Nifty 50 index over a random AMC", () => {
    const sleeve = MAJOR_FUND_SLEEVES.find((s) => s.id === "idx-nifty50")!;
    const picked = pickFundForSleeve(
      [
        fund("Choice Nifty 50 Index Fund", { id: 1, overallScore: 90, expenseRatio: 0.1 }),
        fund("UTI Nifty 50 Index Fund", { id: 2, overallScore: 72, expenseRatio: 0.18 }),
      ],
      sleeve,
    );
    expect(picked?.schemeName).toBe("UTI Nifty 50 Index Fund");
  });

  it("returns one row per sleeve and skips names that are not in the store", () => {
    const rows = pickMajorFunds([
      fund("BANDHAN Small Cap Fund", { id: 10 }),
      fund("HDFC Mid Cap Fund", { id: 11 }),
      fund("Some Unknown Scheme", { id: 12 }),
    ]);
    expect(rows.map((r) => r.sleeve)).toEqual(["Bandhan Small Cap", "HDFC Mid Cap"]);
  });
});
