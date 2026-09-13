import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { corporateActions, stockPrices, stockScores, stocks } from "@/db/schema";
import type { PriceBar } from "@/calculations/trading-days";
import { sliceThrough } from "@/calculations/trading-days";
import { calculateReturns, periodReturn } from "@/calculations/returns";
import { calculateDrawdown } from "@/calculations/drawdown";
import { computeMaBundle } from "@/calculations/moving-averages";
import { rsi, rsScore } from "@/calculations/indicators";
import { DRAWDOWN_THRESHOLDS } from "@/config/defaults";
import { MODEL_VERSIONS } from "@/config/terminal-defaults";
import { dataQualityScore } from "@/scoring/weighted-score";
import { stockOpportunityScore, whyOpportunity, classifyStock } from "@/scoring/stock-opportunity";
import { loadScannerRows } from "@/services/queries";
import { explainMarketReading, whySummary } from "@/services/explain";
import { getSettings } from "@/services/settings";
import { logger } from "@/lib/logger";
import { technicalOverview } from "@/scoring/technical-stance";

function num(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function listActiveStocks() {
  const db = getDb();
  return db.select().from(stocks).where(eq(stocks.active, true));
}

export async function loadStockBars(stockId: number): Promise<PriceBar[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(stockPrices)
    .where(eq(stockPrices.stockId, stockId))
    .orderBy(asc(stockPrices.date));
  return rows.map((r) => ({
    date: r.date,
    open: num(r.open),
    high: num(r.high),
    low: num(r.low),
    close: num(r.adjustedClose) ?? Number(r.close),
    volume: num(r.volume),
  }));
}

export async function computeStockScores(asOf?: string, opts?: { stockIds?: number[] }) {
  const db = getDb();
  const settings = await getSettings();
  const all = opts?.stockIds?.length
    ? await db.select().from(stocks).where(inArray(stocks.id, opts.stockIds))
    : await db.select().from(stocks);
  const withCa = new Set(
    (
      await db
        .selectDistinct({ stockId: corporateActions.stockId })
        .from(corporateActions)
        .where(sql`${corporateActions.factor} is not null`)
    ).map((r) => r.stockId),
  );
  const sectors = await loadScannerRows({ returnType: "PR" });
  const sectorByName = new Map(sectors.map((s) => [s.name.toLowerCase(), s]));
  let n = 0;
  logger.info({ stocks: all.length, asOf: asOf ?? "latest" }, "Computing stock scores");
  for (const stock of all) {
    const bars = await loadStockBars(stock.id);
    const through = asOf ? sliceThrough(bars, asOf) : bars;
    if (through.length < 1) continue;
    const date = through[through.length - 1].date;
    const returns = calculateReturns(through);
    const dd = calculateDrawdown(through, DRAWDOWN_THRESHOLDS, settings.ath_methodology);
    if (!dd) continue;
    const enoughAth = through.length >= 60;
    const mas = computeMaBundle(through);
    const closes = through.map((b) => b.close);
    const rsi14 = rsi(closes);
    const sector = stock.sector ? sectorByName.get(stock.sector.toLowerCase()) : undefined;
    const rs = rsScore(returns.y1, sector?.return1y ?? null);
    const dq = dataQualityScore({
      historyYears: through.length / 252,
      daysStale: 0,
      corporateActionsKnown: withCa.has(stock.id),
      fundamentalsAvailable: false,
      providerOfficial: true,
    });
    const opp = stockOpportunityScore({
      quality: null,
      valuation: null,
      earnings: null,
      sectorRecovery: sector?.recoveryScore ?? null,
      relativeStrength: rs,
      momentum: returns.m1 != null ? Math.max(0, Math.min(100, 50 + returns.m1)) : null,
      balanceSheet: null,
      risk: dd.distanceFromAthPercent >= 50 ? 30 : 55,
      dataQuality: dq,
    });
    const classification = enoughAth
      ? classifyStock({
          drawdown: dd.distanceFromAthPercent,
          quality: null,
          valuation: null,
          earnings: null,
          recovery: sector?.recoveryScore ?? null,
          rs,
          vs200: mas.priceVs200,
          return1m: returns.m1,
          return3m: returns.m3,
        })
      : "INSUFFICIENT_HISTORY";
    const why = whyOpportunity({
      quality: null,
      valuation: null,
      earnings: null,
      sectorRecovery: sector?.recoveryScore ?? null,
      relativeStrength: rs,
      momentum: returns.m1 != null ? Math.max(0, Math.min(100, 50 + returns.m1)) : null,
      dataQuality: dq,
    });
    await db
      .insert(stockScores)
      .values({
        stockId: stock.id,
        date,
        close: String(dd.currentClose),
        distanceFromAth: enoughAth ? String(dd.distanceFromAthPercent) : null,
        return1m: returns.m1 != null ? String(returns.m1) : null,
        return3m: returns.m3 != null ? String(returns.m3) : null,
        return1y: returns.y1 != null ? String(returns.y1) : null,
        return3y: returns.y3 != null ? String(returns.y3) : null,
        return5y: returns.y5 != null ? String(returns.y5) : null,
        priceVs50: mas.priceVs50 != null ? String(mas.priceVs50) : null,
        priceVs200: mas.priceVs200 != null ? String(mas.priceVs200) : null,
        rsi: rsi14 != null ? String(rsi14) : null,
        rsScore: rs != null ? String(rs) : null,
        qualityScore: null,
        valuationScore: null,
        earningsScore: null,
        opportunityScore: opp.score != null ? String(opp.score) : null,
        dataQualityScore: String(dq),
        classification,
        signal: classification,
        explanation: {
          why,
          missing: ["quality", "valuation", "earnings", "fundamentals"],
          note: "Price, ATH and RS use official bhavcopy. adjusted_close uses official split/bonus factors when stored.",
          modelVersion: MODEL_VERSIONS.opportunity,
        },
        modelVersion: MODEL_VERSIONS.opportunity,
      })
      .onConflictDoUpdate({
        target: [stockScores.stockId, stockScores.date],
        set: {
          close: sql`excluded.close`,
          distanceFromAth: sql`excluded.distance_from_ath`,
          return1m: sql`excluded.return_1m`,
          return3m: sql`excluded.return_3m`,
          return1y: sql`excluded.return_1y`,
          return3y: sql`excluded.return_3y`,
          return5y: sql`excluded.return_5y`,
          priceVs50: sql`excluded.price_vs_50`,
          priceVs200: sql`excluded.price_vs_200`,
          rsi: sql`excluded.rsi`,
          rsScore: sql`excluded.rs_score`,
          opportunityScore: sql`excluded.opportunity_score`,
          dataQualityScore: sql`excluded.data_quality_score`,
          classification: sql`excluded.classification`,
          signal: sql`excluded.signal`,
          explanation: sql`excluded.explanation`,
        },
      });
    n += 1;
    if (n % 200 === 0) logger.info({ n, of: all.length }, "Stock score progress");
  }
  return { computed: n };
}

export async function loadStockRows(opts: { asOf?: string; q?: string; classification?: string; index?: string } = {}) {
  const db = getDb();
  const scoreAsOf = (
    await db.select({ date: stockScores.date }).from(stockScores).orderBy(desc(stockScores.date)).limit(1)
  )[0]?.date;
  const priceAsOf = (
    await db.select({ date: stockPrices.date }).from(stockPrices).orderBy(desc(stockPrices.date)).limit(1)
  )[0]?.date;
  const asOf = opts.asOf ?? scoreAsOf ?? priceAsOf;
  if (!asOf) return [];

  const rows = await db
    .select({ stock: stocks, sc: stockScores, px: stockPrices })
    .from(stocks)
    .innerJoin(stockPrices, and(eq(stockPrices.stockId, stocks.id), eq(stockPrices.date, asOf)))
    .leftJoin(stockScores, and(eq(stockScores.stockId, stocks.id), eq(stockScores.date, asOf)));

  return rows
    .filter((r) => {
      if (opts.q && !`${r.stock.symbol} ${r.stock.companyName ?? ""}`.toLowerCase().includes(opts.q.toLowerCase())) {
        return false;
      }
      if (opts.classification && (r.sc?.classification ?? "") !== opts.classification) return false;
      if (opts.index) {
        const memberships = (r.stock.indexMemberships as string[] | null) ?? [];
        if (!memberships.includes(opts.index)) return false;
      }
      return true;
    })
    .map((r) => ({
      id: r.stock.id,
      symbol: r.stock.symbol,
      companyName: r.stock.companyName,
      sector: r.stock.sector,
      industry: r.stock.industry,
      indexMemberships: r.stock.indexMemberships,
      close: num(r.sc?.close) ?? num(r.px.close),
      asOf,
      distanceFromAth: num(r.sc?.distanceFromAth),
      return1m: num(r.sc?.return1m),
      return3m: num(r.sc?.return3m),
      return1y: num(r.sc?.return1y),
      return3y: num(r.sc?.return3y),
      return5y: num(r.sc?.return5y),
      priceVs50: num(r.sc?.priceVs50),
      priceVs200: num(r.sc?.priceVs200),
      rsi: num(r.sc?.rsi),
      rsScore: num(r.sc?.rsScore),
      qualityScore: num(r.sc?.qualityScore),
      valuationScore: num(r.sc?.valuationScore),
      earningsScore: num(r.sc?.earningsScore),
      opportunityScore: num(r.sc?.opportunityScore),
      dataQualityScore: num(r.sc?.dataQualityScore),
      classification: r.sc?.classification ?? "INSUFFICIENT_HISTORY",
      technical: technicalOverview({
        rsi: num(r.sc?.rsi),
        priceVs50: num(r.sc?.priceVs50),
        priceVs200: num(r.sc?.priceVs200),
        return1m: num(r.sc?.return1m),
        return3m: num(r.sc?.return3m),
      }),
      explanation: r.sc?.explanation ?? {
        note: "Scores not computed for this as-of yet. After official history is stored, run ingest:stocks or wait for the daily job.",
      },
      whyShort: whySummary(
        explainMarketReading({
          kind: "STOCK",
          name: r.stock.companyName ? `${r.stock.symbol} · ${r.stock.companyName}` : r.stock.symbol,
          signal: r.sc?.signal ?? r.sc?.classification ?? "INSUFFICIENT_HISTORY",
          classification: r.sc?.classification ?? "INSUFFICIENT_HISTORY",
          return1m: num(r.sc?.return1m),
          return3m: num(r.sc?.return3m),
          return1y: num(r.sc?.return1y),
          return3y: num(r.sc?.return3y),
          return5y: num(r.sc?.return5y),
          priceVs50: num(r.sc?.priceVs50),
          priceVs200: num(r.sc?.priceVs200),
          drawdown: num(r.sc?.distanceFromAth),
          sectorName: r.stock.sector ?? r.stock.industry,
        }),
      ),
    }))
    .sort((a, b) => (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1) || a.symbol.localeCompare(b.symbol));
}

export function cagrFromReturn(totalReturnPct: number | null, years: number): number | null {
  if (totalReturnPct == null || years <= 0) return null;
  const growth = 1 + totalReturnPct / 100;
  if (growth <= 0) return null;
  return (growth ** (1 / years) - 1) * 100;
}

export function relativeReturn(asset: number | null, bench: number | null) {
  if (asset == null || bench == null) return null;
  return periodReturn(100 + asset, 100 + bench) != null ? asset - bench : asset - bench;
}
