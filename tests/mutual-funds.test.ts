import { describe, expect, it } from "vitest";
import {
  absoluteReturn,
  cagr,
  calendarYearReturns,
  diversificationScore,
  downsideDeviation,
  expenseImpact,
  navDrawdown,
  overlapHoldings,
  periodStats,
  rollingCagr,
  sharpeRatio,
  sipFutureValue,
  sipResult,
  sortinoRatio,
  taxCategoryInfo,
  xirr,
} from "@/mf/calculations";
import { parseAmfiDate, parseAmfiNavText, inferOption, inferPlan, parseCategoryHeader } from "@/mf/amfi-parse";
import { classifyFund, partScores, researchScore } from "@/mf/scoring";
import { impliedSectorFromCategory, mapToNiftySector } from "@/mf/sector-map";

describe("AMFI official parser", () => {
  it("parses official NAV history layout (Name;Plan;Option;ISIN;NAV;Date)", () => {
    const text = `
Scheme Code;NAV Name;Plan;Option;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Net Asset Value;Date
Open Ended Schemes ( Equity Scheme - Flexi Cap Fund )
118834;Nippon India Flexi Cap Fund - Direct Plan - Growth;Direct Plan;Growth Option;INF204K01XX1;-;45.12;01-Sep-2026
`;
    const rows = parseAmfiNavText(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].schemeName).toMatch(/Flexi Cap/i);
    expect(rows[0].plan).toBe("DIRECT");
    expect(rows[0].nav).toBeCloseTo(45.12);
  });

  it("parses current 8-column official NAVAll (Plan/Option columns)", () => {
    const text = `
Open Ended Schemes(Equity Scheme - Large Cap Fund)
ICICI Prudential Mutual Fund
112090;INF109K01LZ0;-;ICICI Prudential Bluechip Fund;Direct Plan;Growth Option;98.12;11-Sep-2026
112091;INF109K01LY3;-;ICICI Prudential Bluechip Fund;Regular Plan;Growth Option;90.10;11-Sep-2026
`;
    const rows = parseAmfiNavText(text);
    expect(rows).toHaveLength(2);
    expect(rows[0].plan).toBe("DIRECT");
    expect(rows[0].option).toBe("GROWTH");
    expect(rows[0].nav).toBeCloseTo(98.12);
    expect(rows[0].date).toBe("2026-09-11");
    expect(rows[1].plan).toBe("REGULAR");
  });

  it("parses NAVAll-style official text with category headers", () => {
    const text = `
Open Ended Schemes (Equity Scheme - Large Cap Fund)
Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
112090;INF109K01LZ0;-;ICICI Prudential Bluechip Fund - Direct Plan - Growth;98.12;11-Sep-2026
112091;INF109K01LY3;-;ICICI Prudential Bluechip Fund - Regular Plan - Growth;90.10;11-Sep-2026
Open Ended Schemes (Equity Scheme - Small Cap Fund)
118834;INF247L01445;-;Nippon India Small Cap Fund - Direct Plan - IDCW;140.00;11-Sep-2026
`;
    const rows = parseAmfiNavText(text);
    expect(rows).toHaveLength(3);
    expect(rows[0].plan).toBe("DIRECT");
    expect(rows[0].option).toBe("GROWTH");
    expect(rows[0].category.toLowerCase()).toContain("large");
    expect(rows[1].plan).toBe("REGULAR");
    expect(rows[2].option).toBe("IDCW");
    expect(rows[2].category.toLowerCase()).toContain("small");
    expect(rows[0].date).toBe("2026-09-11");
  });

  it("does not mix Direct and Regular or Growth and IDCW", () => {
    expect(inferPlan("HDFC Flexi Cap Fund - Direct Plan - Growth")).toBe("DIRECT");
    expect(inferPlan("HDFC Flexi Cap Fund - Regular Plan - Growth")).toBe("REGULAR");
    expect(inferOption("Axis ELSS Tax Saver Fund - Direct Plan - IDCW")).toBe("IDCW");
  });

  it("reads official SEBI/AMFI category headers", () => {
    const c = parseCategoryHeader("Open Ended Schemes (Debt Scheme - Liquid Fund)");
    expect(c.assetClass).toBe("Debt");
    expect(c.category.toLowerCase()).toContain("liquid");
  });

  it("parses AMFI dates", () => {
    expect(parseAmfiDate("11-Sep-2026")).toBe("2026-09-11");
  });
});

describe("MF returns and SIP", () => {
  const navs = Array.from({ length: 61 }, (_, i) => {
    const d = new Date(Date.UTC(2020, 0, 1));
    d.setUTCMonth(i);
    return { date: d.toISOString().slice(0, 10), nav: 100 * Math.pow(1.01, i) };
  });

  it("uses absolute return under 1Y and CAGR over 1Y", () => {
    expect(absoluteReturn(110, 100)).toBeCloseTo(10);
    expect(cagr(121, 100, 2)).toBeCloseTo(10);
    const one = periodStats(navs, navs.at(-1)!.date, 0.5);
    const fiveish = periodStats(navs, navs.at(-1)!.date, 3);
    expect(one.abs).not.toBeNull();
    expect(fiveish.cagr).not.toBeNull();
  });

  it("computes XIRR and SIP XIRR", () => {
    const r = xirr([
      { date: "2020-01-01", amount: -10000 },
      { date: "2021-01-01", amount: 11000 },
    ]);
    expect(r).toBeGreaterThan(8);
    expect(r).toBeLessThan(12);
    const sip = sipResult(navs, navs.at(-1)!.date, 3, 10000);
    expect(sip).not.toBeNull();
    expect(sip!.invested).toBeGreaterThan(0);
    expect(sip!.xirr).not.toBeNull();
  });

  it("computes Sharpe from CAGR and vol", () => {
    expect(sharpeRatio(14, 10, 6.5)).toBeCloseTo(0.75);
    expect(sharpeRatio(null, 10)).toBeNull();
  });
});

describe("Overlap, expense, scoring, sector map", () => {
  it("measures portfolio overlap without inventing holdings", () => {
    const o = overlapHoldings(
      [
        { securityName: "Infosys", isin: "INE009A01021", weight: 8 },
        { securityName: "HDFC Bank", isin: "INE040A01034", weight: 10 },
      ],
      [
        { securityName: "Infosys", isin: "INE009A01021", weight: 6 },
        { securityName: "TCS", isin: "INE467B01029", weight: 7 },
      ],
    );
    expect(o.overlapPct).toBeCloseTo(6);
    expect(o.common[0].name).toBe("Infosys");
  });

  it("estimates long-term TER gap cost", () => {
    const impact = expenseImpact(0.9, 10, 100000, 0.12);
    expect(impact.cost).toBeGreaterThan(0);
    expect(impact.withExtraFee).toBeLessThan(impact.withoutExtraFee);
  });

  it("does not rank solely on 5Y return", () => {
    const lucky = partScores({
      cagr5y: 28,
      cagr3y: 30,
      sharpe: 0.1,
      sortino: 0.1,
      maxDrawdown: -48,
      rollingBeatPct: 35,
      rollingStdev: 16,
      excess5y: 1,
      ter: 2.1,
      top10: 72,
      managerTenure: 0.4,
      aumCr: 80,
      sectorAlignment: 20,
    });
    const quality = partScores({
      cagr5y: 14,
      cagr3y: 13,
      sharpe: 1.1,
      sortino: 1.3,
      maxDrawdown: -18,
      rollingBeatPct: 78,
      rollingStdev: 5,
      excess5y: 2.5,
      ter: 0.55,
      top10: 32,
      managerTenure: 7,
      aumCr: 12000,
      sectorAlignment: 60,
    });
    const luckyScore = researchScore(lucky, "Equity").overall ?? 0;
    const qualityScore = researchScore(quality, "Equity").overall ?? 0;
    expect(qualityScore).toBeGreaterThan(luckyScore);
  });

  it("maps holding sectors onto NSE indices", () => {
    expect(mapToNiftySector("Information Technology")).toBe("NIFTY IT");
    expect(mapToNiftySector("Banks")).toBe("NIFTY BANK");
  });

  it("classifies research labels without buy language", () => {
    expect(classifyFund(88, -20, 1.1)).toBe("ELITE");
    expect(classifyFund(15, -50, -0.2)).toBe("AVOID_FOR_RESEARCH");
  });
});

describe("Look-ahead isolation", () => {
  it("period and rolling stats never use NAV after as-of", () => {
    const navs = [
      { date: "2018-01-01", nav: 100 },
      { date: "2019-01-01", nav: 110 },
      { date: "2020-01-01", nav: 121 },
      { date: "2021-01-01", nav: 400 },
    ];
    const asOf = "2020-01-01";
    const one = periodStats(navs, asOf, 1);
    expect(one.abs).not.toBeNull();
    expect(one.abs!).toBeLessThan(25);
    expect(one.abs!).toBeGreaterThan(5);
    const after = periodStats(navs, "2021-01-01", 1);
    expect(after.abs!).toBeGreaterThan(100);
    const rolls = rollingCagr(navs, 1, asOf);
    expect(rolls.every((v) => v < 50)).toBe(true);
  });
});

describe("Risk, drawdown, SIP goal, tax", () => {
  const navs = [
    { date: "2020-01-01", nav: 100 },
    { date: "2020-07-01", nav: 80 },
    { date: "2021-01-01", nav: 90 },
    { date: "2021-07-01", nav: 120 },
    { date: "2022-01-01", nav: 110 },
    { date: "2023-01-01", nav: 140 },
  ];

  it("computes Sortino, downside deviation and max drawdown from NAV only", () => {
    expect(sortinoRatio(navs, 12, 6.5)).not.toBeNull();
    expect(downsideDeviation(navs)).not.toBeNull();
    const dd = navDrawdown(navs);
    expect(dd?.maxDrawdown).toBeLessThan(0);
    expect(dd?.currentDrawdown).toBeGreaterThanOrEqual(0);
  });

  it("shows calendar-year consistency without fabricating missing years", () => {
    const years = calendarYearReturns(navs);
    expect(years.map((y) => y.year)).toEqual([2020, 2021, 2022, 2023]);
  });

  it("SIP goal calculator is an assumption, not a guarantee", () => {
    const s = sipFutureValue(10000, 12, 10);
    expect(s.invested).toBe(1_200_000);
    expect(s.value).toBeGreaterThan(s.invested);
    expect(s.rate).toBe(12);
  });

  it("tax block is category context only", () => {
    expect(taxCategoryInfo("Equity", "ELSS").taxCategory).toContain("ELSS");
    expect(taxCategoryInfo("Debt", "Liquid").source).toMatch(/not tax advice/i);
  });

  it("diversification score penalizes high overlap", () => {
    const high = diversificationScore({ pairwiseOverlap: 62, sectorHhi: 3500, assetClassCount: 1, geographicCount: 1 });
    const low = diversificationScore({ pairwiseOverlap: 12, sectorHhi: 1200, assetClassCount: 3, geographicCount: 2 });
    expect(low).toBeGreaterThan(high);
  });

  it("maps sectoral categories onto NSE indices as a labelled proxy", () => {
    const implied = impliedSectorFromCategory("Sectoral - IT", "Equity");
    expect(implied[0]?.nseName).toBe("NIFTY IT");
    expect(implied[0]?.source).toBe("category");
  });
});
