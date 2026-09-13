import { describe, expect, it } from "vitest";
import { rsi, rsScore, bollinger } from "@/calculations/indicators";
import { calculateDrawdown } from "@/calculations/drawdown";
import { DRAWDOWN_THRESHOLDS } from "@/config/defaults";
import { sliceThrough } from "@/calculations/trading-days";
import type { PriceBar } from "@/calculations/trading-days";
import { weightedAvailable } from "@/scoring/weighted-score";
import { qualityScore } from "@/scoring/quality-score";
import { isValueTrap, valuationPercentile, valuationLabel, qarpScore } from "@/scoring/valuation-score";
import { earningsQualityWarnings, earningsMomentumScore } from "@/scoring/earnings-score";
import { classifyOpportunity, confidenceLabel } from "@/scoring/opportunity-classify";
import { detectMarketRegime, classifyBreadthDivergence } from "@/scoring/regime";
import { sectorBreadthFromRows } from "@/services/market-context";
import {
  assertNoLookAhead,
  matchesScreen,
  labeledForward,
  sampleAsOfDates,
  summarizeTrades,
  walkForwardWindows,
  bootstrapReturnRange,
  computeStockSnapshot,
  type SnapshotRow,
  type Trade,
} from "@/services/strategy-lab";
import { parseResearchQuery } from "@/services/nl-screener";
import { extractFirstCsvFromZip, historicalBhavZipPath, parseOfficialBhavcopy } from "@/providers/nse-bhavcopy";
import { parseOfficialConstituentCsv } from "@/providers/nse-constituents";
import { correlationMatrix } from "@/services/portfolio-analytics";
import { portfolioRiskWarnings } from "@/services/research-lists";

function sequential(n: number, start = 100): PriceBar[] {
  const out: PriceBar[] = [];
  const d = new Date("2018-01-01T00:00:00Z");
  let px = start;
  for (let i = 0; i < n; i++) {
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    out.push({ date: d.toISOString().slice(0, 10), close: px, high: px + 1, open: px, low: px - 1 });
    px += 0.4;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const row = (over: Partial<SnapshotRow> = {}): SnapshotRow => ({
  assetId: 1,
  name: "Test",
  asOf: "2020-03-23",
  close: 60,
  distanceFromAth: 40,
  return1m: -2,
  return3m: -10,
  return1y: -25,
  recoveryScore: 62,
  opportunityScore: 70,
  qualityScore: null,
  valuationScore: null,
  earningsScore: null,
  rsScore: null,
  priceVs200: -5,
  signal: "EARLY_RECOVERY",
  ...over,
});

describe("Indicators", () => {
  it("RSI is 100 when the series only rises", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(closes)).toBe(100);
  });

  it("relative strength score is 50 when returns match", () => {
    expect(rsScore(10, 10)).toBe(50);
    expect(rsScore(null, 10)).toBeNull();
  });

  it("Bollinger mid equals the 20-day average", () => {
    const closes = Array.from({ length: 20 }, () => 10);
    const b = bollinger(closes);
    expect(b.mid).toBeCloseTo(10);
    expect(b.upper).toBeCloseTo(10);
  });
});

describe("Weighted / quality / valuation scores", () => {
  it("omits missing weights instead of treating them as 0", () => {
    const r = weightedAvailable({ quality: 80, valuation: null }, { quality: 0.5, valuation: 0.5 });
    expect(r.score).toBeCloseTo(80);
    expect(r.missing).toEqual(["valuation"]);
  });

  it("quality is N/A when every input is missing", () => {
    expect(qualityScore({}).score).toBeNull();
  });

  it("does not call cheap+deteriorating a buy", () => {
    expect(
      isValueTrap({
        valuation: 80,
        earnings: 20,
        quality: 30,
        rs: 10,
      }),
    ).toBe(true);
  });

  it("valuation percentile and label", () => {
    const hist = Array.from({ length: 30 }, (_, i) => 10 + i);
    const p = valuationPercentile(12, hist);
    expect(p).not.toBeNull();
    expect(p!).toBeLessThan(25);
    expect(valuationLabel(p)).toBe("Historically inexpensive");
  });

  it("QARP is null without components", () => {
    expect(qarpScore({ quality: null, growth: null, valuation: null, risk: null }).score).toBeNull();
  });
});

describe("Earnings quality", () => {
  it("flags profit up and cash flow down", () => {
    expect(earningsQualityWarnings({ patChange: 10, ocfChange: -5 })).toContain("CASH_FLOW_WARNING");
  });

  it("earnings momentum is N/A without inputs", () => {
    expect(earningsMomentumScore({}).score).toBeNull();
  });
});

describe("Classifications", () => {
  it("separates falling knife from early recovery", () => {
    expect(
      classifyOpportunity({
        drawdown: 45,
        quality: null,
        valuation: null,
        earnings: null,
        recovery: 20,
        rs: -20,
        vs200: -8,
        return1m: -6,
        return3m: -12,
      }),
    ).toBe("FALLING_KNIFE");
    expect(
      classifyOpportunity({
        drawdown: 42,
        quality: null,
        valuation: null,
        earnings: null,
        recovery: 60,
        rs: 5,
        vs200: -1,
        return1m: 1,
        return3m: -4,
      }),
    ).toBe("EARLY_RECOVERY");
  });
});

describe("Strategy Lab screens and look-ahead", () => {
  it("fails a quality minimum when quality is missing (never invents 0)", () => {
    expect(matchesScreen(row(), { minQuality: 70 })).toBe(false);
    expect(matchesScreen(row({ qualityScore: 80 }), { minQuality: 70 })).toBe(true);
  });

  it("throws if an observation after as-of is used", () => {
    expect(() => assertNoLookAhead("2020-03-23", ["2020-03-23", "2020-03-24"])).toThrow(/Look-ahead/);
    expect(() => assertNoLookAhead("2020-03-23", ["2020-03-20", "2020-03-23"])).not.toThrow();
  });

  it("ATH as-of T ignores a later peak", () => {
    const bars: PriceBar[] = [
      { date: "2019-01-02", close: 100, high: 100, open: 100, low: 100 },
      { date: "2020-03-23", close: 55, high: 55, open: 55, low: 55 },
      { date: "2024-01-02", close: 180, high: 180, open: 180, low: 180 },
    ];
    const through = sliceThrough(bars, "2020-03-23");
    const dd = calculateDrawdown(through, DRAWDOWN_THRESHOLDS)!;
    expect(dd.ath).toBe(100);
    expect(dd.distanceFromAthPercent).toBeCloseTo(45);
    const snap = computeStockSnapshot(1, "X", through, "2020-03-23");
    expect(snap.distanceFromAth).toBeCloseTo(45);
  });

  it("labeled forward return is subsequent, not an input", () => {
    const bars = sequential(400);
    const asOf = bars[100].date;
    const fwd = labeledForward(bars, asOf, 21);
    expect(fwd).not.toBeNull();
    const future = bars[100 + 21].close;
    const start = bars[100].close;
    expect(fwd).toBeCloseTo(((future / start) - 1) * 100);
  });

  it("samples as-of dates without using future bars", () => {
    const bars = sequential(80);
    const dates = sampleAsOfDates(bars, bars[0].date, bars[40].date, 10);
    expect(dates.every((d) => d <= bars[40].date)).toBe(true);
  });

  it("warns when the historical sample is too small", () => {
    const trades: Trade[] = [1, 2, 3].map((i) => ({
      ...row({ assetId: i }),
      holdTradingDays: 21,
      forwardReturn: 5,
      benchmarkReturn: 2,
      excessReturn: 3,
    }));
    const stats = summarizeTrades(trades);
    expect(stats.withOutcome).toBe(3);
    expect(stats.caution).toMatch(/Insufficient historical evidence/i);
    expect(confidenceLabel(7, 100).note).toMatch(/Insufficient/);
    expect(confidenceLabel(15, 100).note).toMatch(/Small sample/);
  });

  it("walk-forward windows do not overlap train into the future of that window", () => {
    const windows = walkForwardWindows("2016-01-01", "2022-01-01", 24, 12);
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      expect(w.trainTo <= w.testFrom).toBe(true);
      expect(w.testFrom < w.testTo).toBe(true);
    }
  });

  it("bootstrap is labelled as a simulation of history", () => {
    const r = bootstrapReturnRange(Array.from({ length: 30 }, (_, i) => i - 10));
    expect(r.p50).not.toBeNull();
    expect(r.note).toMatch(/Not a prediction/);
  });
});

describe("Market regime and breadth", () => {
  it("classifies a shallow uptrend as bullish context", () => {
    const r = detectMarketRegime({
      nifty50Return1y: 18,
      nifty50Return6m: 8,
      nifty50Return1m: 2,
      nifty50PriceVs50: 3,
      nifty50PriceVs200: 6,
      nifty50Drawdown: 4,
      nifty500Return1y: 16,
    });
    expect(r.regime).toBe("BULL");
    expect(r.score).toBeGreaterThan(50);
  });

  it("detects negative breadth divergence", () => {
    expect(
      classifyBreadthDivergence({
        indexReturn1m: 4,
        sectorPctAbove50: 40,
        prevSectorPctAbove50: 55,
      }),
    ).toBe("NEGATIVE_BREADTH_DIVERGENCE");
  });

  it("computes sector breadth from existing scanner fields", () => {
    const b = sectorBreadthFromRows([
      { priceVs50: 2, priceVs200: 1, distanceFromAth: 12, return1d: 1, signal: "RECOVERING" },
      { priceVs50: -3, priceVs200: -4, distanceFromAth: 35, return1d: -1, signal: "FALLING_KNIFE" },
    ]);
    expect(b.count).toBe(2);
    expect(b.pctBelow30).toBe(50);
    expect(b.recovering).toBe(1);
    expect(b.falling).toBe(1);
  });
});

describe("Official parsers", () => {
  it("parses a bhavcopy header without inventing prices", () => {
    const csv = `SYMBOL,SERIES,DATE1,OPEN_PRICE,HIGH_PRICE,LOW_PRICE,CLOSE_PRICE,TTL_TRD_QTY,DELIV_QTY
RELIANCE,EQ,12-Sep-2026,1400,1410,1390,1405,1000,400
SOMETHING,SM,12-Sep-2026,10,11,9,10,1,0`;
    const rows = parseOfficialBhavcopy(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("RELIANCE");
    expect(rows[0].close).toBe(1405);
  });

  it("parses the older official cash bhavcopy header", () => {
    const csv = `SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,TOTTRDQTY,TOTTRDVAL,TIMESTAMP,TOTALTRADES,ISIN
RELIANCE,EQ,1400,1410,1390,1405,1404,1390,1000,1405000,12-SEP-2024,10,INE002A01018`;
    const rows = parseOfficialBhavcopy(csv);
    expect(rows[0].date).toBe("2024-09-12");
    expect(rows[0].close).toBe(1405);
  });

  it("builds the official historical zip path", () => {
    expect(historicalBhavZipPath("2024-01-15")).toBe("2024/JAN/cm15JAN2024bhav.csv.zip");
  });

  it("extracts a stored CSV from an official-style zip", () => {
    const csv = "SYMBOL,SERIES,CLOSE\nRELIANCE,EQ,1405\n";
    const name = Buffer.from("cm15JAN2024bhav.csv");
    const data = Buffer.from(csv);
    const hdr = Buffer.alloc(30);
    hdr.writeUInt32LE(0x04034b50, 0);
    hdr.writeUInt16LE(0, 8);
    hdr.writeUInt32LE(data.length, 18);
    hdr.writeUInt32LE(data.length, 22);
    hdr.writeUInt16LE(name.length, 26);
    const text = extractFirstCsvFromZip(Buffer.concat([hdr, name, data]));
    expect(parseOfficialBhavcopy(text)[0].symbol).toBe("RELIANCE");
  });

  it("extracts a streaming zip that uses a data descriptor (older NSE bhavcopy)", () => {
    const csv = "SYMBOL,SERIES,CLOSE\nRELIANCE,EQ,1405\n";
    const name = Buffer.from("cm19FEB2015bhav.csv");
    const data = Buffer.from(csv);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(0x0008, 6);
    local.writeUInt16LE(name.length, 26);
    const dd = Buffer.alloc(16);
    dd.writeUInt32LE(0x08074b50, 0);
    dd.writeUInt32LE(data.length, 8);
    dd.writeUInt32LE(data.length, 12);
    const cdOff = 30 + name.length + data.length + 16;
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(0x0008, 8);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(46 + name.length, 12);
    eocd.writeUInt32LE(cdOff, 16);
    const text = extractFirstCsvFromZip(Buffer.concat([local, name, data, dd, cd, name, eocd]));
    expect(parseOfficialBhavcopy(text)[0].symbol).toBe("RELIANCE");
  });

  it("parses official index membership lists", () => {
    const csv = `Company Name,Industry,Symbol,Series,ISIN Code
Reliance Industries Ltd,Oil Gas,RELIANCE,EQ,INE002A01018`;
    const rows = parseOfficialConstituentCsv(csv, "NIFTY50");
    expect(rows[0].symbol).toBe("RELIANCE");
    expect(rows[0].index).toBe("NIFTY50");
  });
});

describe("Natural language screener", () => {
  it("translates a high-quality beaten-down query into filters", () => {
    const p = parseResearchQuery("Find high-quality stocks in sectors more than 30% below ATH");
    expect(p.asset).toBe("STOCK");
    expect(p.conditions.minDrawdown).toBe(30);
    expect(p.conditions.minQuality).toBe(70);
  });
});

describe("Portfolio risk warnings", () => {
  it("flags concentrated sector and single-name weights", () => {
    const w = portfolioRiskWarnings(
      [
        { assetType: "STOCK", assetName: "A", weightPct: 40, sector: "IT" },
        { assetType: "STOCK", assetName: "B", weightPct: 60, sector: "IT" },
      ],
      { maxSingle: 15, maxSector: 35 },
    );
    expect(w.some((x) => /A is 40%/.test(x))).toBe(true);
    expect(w.some((x) => /IT exposure/.test(x))).toBe(true);
  });

  it("correlation is null with short overlap", () => {
    const m = correlationMatrix(
      [
        { name: "A", closes: [{ date: "2020-01-01", close: 1 }, { date: "2020-01-02", close: 1.1 }] },
        { name: "B", closes: [{ date: "2020-01-01", close: 2 }, { date: "2020-01-02", close: 2.2 }] },
      ],
      252,
    );
    expect(Number.isNaN(m.matrix[0][1]) || m.matrix[0][1] == null).toBe(true);
  });
});
