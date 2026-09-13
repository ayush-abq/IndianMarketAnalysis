import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  indexDrawdowns,
  indexPrices,
  indexReturns,
  indexScores,
  indices,
} from "@/db/schema";
import type { PriceBar } from "@/calculations/trading-days";
import { sliceThrough, sortBars } from "@/calculations/trading-days";
import { calculateDrawdown } from "@/calculations/drawdown";
import { calculateReturns } from "@/calculations/returns";
import { computeMaBundle } from "@/calculations/moving-averages";
import { relativeStrengthBundle } from "@/calculations/relative-strength";
import { analyzeHistoricalDrawdowns } from "@/calculations/historical-drawdowns";
import { realizedVol20d, volPercentile } from "@/calculations/volatility";
import { drawdownScore } from "@/scoring/drawdown-score";
import { weaknessScore } from "@/scoring/weakness-score";
import { momentumReversalScore, momentumScore } from "@/scoring/momentum-score";
import { detectHigherLow, recoveryScore } from "@/scoring/recovery-score";
import { compositeResearchScore, opportunityScore } from "@/scoring/opportunity-score";
import {
  classificationFromState,
  resolveSignal,
  type ResearchSignal,
} from "@/scoring/signals";
import { capitulationScore, detectRegime } from "@/scoring/regime";
import { generateResearchNote } from "@/services/research-notes";
import { getSettings } from "@/services/settings";
import { logger } from "@/lib/logger";
import { round } from "@/lib/utils";
import type { AppSettings } from "@/config/defaults";

export type ComputedIndex = {
  indexId: number;
  asOf: string;
  returnType: "PR" | "TR";
  returns: ReturnType<typeof calculateReturns>;
  drawdown: NonNullable<ReturnType<typeof calculateDrawdown>>;
  mas: ReturnType<typeof computeMaBundle>;
  hist: NonNullable<ReturnType<typeof analyzeHistoricalDrawdowns>>;
  scores: {
    drawdown: number;
    drawdownContinuous: number;
    weakness: number | null;
    momentum: number;
    reversal: number;
    recovery: number;
    opportunity: number;
    overall: number;
    capitulation: number;
    rs: number | null;
  };
  rs: ReturnType<typeof relativeStrengthBundle>;
  signal: ResearchSignal;
  classification: string;
  regime: string;
  researchNote: string;
  vol20: number | null;
};

function num(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function loadBars(
  indexId: number,
  returnType: "PR" | "TR",
): Promise<PriceBar[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(indexPrices)
    .where(and(eq(indexPrices.indexId, indexId), eq(indexPrices.returnType, returnType)))
    .orderBy(asc(indexPrices.date));
  return rows
    .map((r) => ({
      date: r.date,
      open: num(r.open),
      high: num(r.high),
      low: num(r.low),
      close: Number(r.close),
      volume: num(r.volume),
    }))
    .filter((b) => Number.isFinite(b.close));
}

export function computeForBars(
  bars: PriceBar[],
  asOf: string,
  settings: AppSettings,
  benchmarks: {
    nifty50: ReturnType<typeof calculateReturns> | null;
    nifty500: ReturnType<typeof calculateReturns> | null;
    nifty50Mas: ReturnType<typeof computeMaBundle> | null;
  },
  name: string,
): ComputedIndex | null {
  const through = sortBars(sliceThrough(bars, asOf));
  if (through.length < 2) return null;
  const drawdown = calculateDrawdown(through, settings.drawdown_thresholds, settings.ath_methodology);
  if (!drawdown) return null;
  const returns = calculateReturns(through);
  const mas = computeMaBundle(through);
  const hist = analyzeHistoricalDrawdowns(through);
  if (!hist) return null;

  const rs = relativeStrengthBundle(
    { m1: returns.m1, m3: returns.m3, m6: returns.m6, y1: returns.y1 },
    {
      m1: benchmarks.nifty50?.m1 ?? null,
      m3: benchmarks.nifty50?.m3 ?? null,
      m6: benchmarks.nifty50?.m6 ?? null,
      y1: benchmarks.nifty50?.y1 ?? null,
    },
    {
      m1: benchmarks.nifty500?.m1 ?? null,
      m3: benchmarks.nifty500?.m3 ?? null,
      m6: benchmarks.nifty500?.m6 ?? null,
      y1: benchmarks.nifty500?.y1 ?? null,
    },
  );

  const dd = drawdownScore(drawdown.distanceFromAthPercent);
  const weak = weaknessScore(
    { y1: returns.y1, y2: returns.y2, y5: returns.y5 },
    settings.return_thresholds,
    settings.weakness_weights,
  );
  const mom = momentumScore({
    d1: returns.d1,
    d5: returns.d5,
    d20: returns.d20,
    d50: returns.d50,
    d200: returns.d200,
    trendState: mas.trendState,
  });
  const reversal = momentumReversalScore({
    d5: returns.d5,
    d20: returns.d20,
    m3: returns.m3,
    priceVs50: mas.priceVs50,
    trendState: mas.trendState,
  });
  const rec = recoveryScore(
    {
      recoveryFromTroughPct: hist.recoveryFromTroughPct,
      return5d: returns.d5,
      return20d: returns.d20,
      priceVs50: mas.priceVs50,
      priceVs200: mas.priceVs200,
      return3m: returns.m3,
      return6m: returns.m6,
      rs1m: rs.vs50.m1,
      crossed50: mas.cross50,
      crossed200: mas.cross200,
      higherLow: detectHigherLow(through.map((b) => b.close)),
    },
    settings.recovery_weights,
  );
  const cap = capitulationScore({
    distanceFromAth: drawdown.distanceFromAthPercent,
    return1y: returns.y1,
    volPercentile: null,
    return1m: returns.m1,
    recoveryScore: rec,
  });
  const opp = opportunityScore(
    {
      drawdown: dd.blended,
      weakness: weak.weighted,
      momentumReversal: reversal,
      recovery: rec,
      relativeStrength: rs.vs50.y1,
    },
    settings.opportunity_weights,
  );
  const overall = compositeResearchScore(
    {
      drawdown: dd.blended,
      weakness: weak.weighted,
      recovery: rec,
      momentum: mom,
      relativeStrength: rs.vs50.y1,
      breadth: null,
      capitulation: cap,
    },
    settings.composite_weights,
  );

  const vol20 = realizedVol20d(through);
  const signalInput = {
    distanceFromAth: drawdown.distanceFromAthPercent,
    return1m: returns.m1,
    return3m: returns.m3,
    return1y: returns.y1,
    return2y: returns.y2,
    return5y: returns.y5,
    priceVs200: mas.priceVs200,
    ma200Slope: mas.ma200Slope,
    rs1m: rs.vs50.m1,
    rs3m: rs.vs50.m3,
    rs1y: rs.vs50.y1,
    priceVs50: mas.priceVs50,
    crossed50: mas.cross50,
    recoveryScore: rec,
    volPercentile: volPercentile(vol20, []),
    return20d: returns.d20,
    trendState: mas.trendState,
  };
  const signal = resolveSignal(signalInput, settings.signal_thresholds);
  const classification = classificationFromState({
    bucket: drawdown.bucket,
    signal,
    opportunityLabel: "",
  });
  const regime = detectRegime({
    nifty50Return1y: benchmarks.nifty50?.y1 ?? null,
    nifty50Return6m: benchmarks.nifty50?.m6 ?? null,
    nifty50PriceVs200: benchmarks.nifty50Mas?.priceVs200 ?? null,
    nifty500Return1y: benchmarks.nifty500?.y1 ?? null,
  });
  const researchNote = generateResearchNote({
    name,
    distanceFromAth: drawdown.distanceFromAthPercent,
    athDate: drawdown.athDate,
    return1y: returns.y1,
    return2y: returns.y2,
    return5y: returns.y5,
    return1m: returns.m1,
    return3m: returns.m3,
    priceVs50: mas.priceVs50,
    priceVs200: mas.priceVs200,
    rs1yNifty50: rs.vs50.y1,
    recoveryScore: rec,
    signal,
    trendState: mas.trendState,
  });

  return {
    indexId: 0,
    asOf: through[through.length - 1].date,
    returnType: "PR",
    returns,
    drawdown,
    mas,
    hist,
    scores: {
      drawdown: dd.blended,
      drawdownContinuous: dd.continuous,
      weakness: weak.weighted,
      momentum: mom,
      reversal,
      recovery: rec,
      opportunity: opp,
      overall,
      capitulation: cap,
      rs: rs.vs50.y1,
    },
    rs,
    signal,
    classification,
    regime,
    researchNote,
    vol20,
  };
}

export async function recomputeAll(asOf?: string, returnType: "PR" | "TR" = "PR") {
  const db = getDb();
  const settings = await getSettings();
  const all = await db.select().from(indices).where(eq(indices.active, true));
  const nifty50 = all.find((i) => i.nseName === "NIFTY 50" || i.symbol === "NIFTY50");
  const nifty500 = all.find((i) => i.nseName === "NIFTY 500" || i.symbol === "NIFTY500");

  const benchBars50 = nifty50 ? await loadBars(nifty50.id, returnType) : [];
  const benchBars500 = nifty500 ? await loadBars(nifty500.id, returnType) : [];
  const date =
    asOf ??
    benchBars50.at(-1)?.date ??
    benchBars500.at(-1)?.date ??
    (await latestAnyDate(returnType));
  if (!date) {
    logger.warn("No prices in database — skipping metric computation");
    return { computed: 0, asOf: null };
  }

  const b50 = sliceThrough(benchBars50, date);
  const b500 = sliceThrough(benchBars500, date);
  const benchmarks = {
    nifty50: b50.length >= 2 ? calculateReturns(b50) : null,
    nifty500: b500.length >= 2 ? calculateReturns(b500) : null,
    nifty50Mas: b50.length >= 2 ? computeMaBundle(b50) : null,
  };

  let computed = 0;
  for (const idx of all) {
    const bars = idx.id === nifty50?.id ? benchBars50 : idx.id === nifty500?.id ? benchBars500 : await loadBars(idx.id, returnType);
    const result = computeForBars(bars, date, settings, benchmarks, idx.name);
    if (!result) continue;
    result.indexId = idx.id;
    result.returnType = returnType;
    await persistComputed(result);
    computed += 1;
  }
  logger.info({ computed, asOf: date, returnType }, "Recomputed metrics from local database");
  return { computed, asOf: date };
}

async function latestAnyDate(returnType: "PR" | "TR"): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ date: indexPrices.date })
    .from(indexPrices)
    .where(eq(indexPrices.returnType, returnType))
    .orderBy(asc(indexPrices.date));
  return rows.at(-1)?.date ?? null;
}

function n(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? null : String(round(value, 6));
}

async function persistComputed(c: ComputedIndex) {
  const db = getDb();
  const r = c.returns;
  const d = c.drawdown;
  const h = c.hist;

  await db
    .insert(indexReturns)
    .values({
      indexId: c.indexId,
      date: c.asOf,
      returnType: c.returnType,
      return1d: n(r.d1),
      return1w: n(r.w1),
      return1m: n(r.m1),
      return3m: n(r.m3),
      return6m: n(r.m6),
      return1y: n(r.y1),
      return2y: n(r.y2),
      return3y: n(r.y3),
      return5y: n(r.y5),
      returnSinceInception: n(r.sinceInception),
      return5d: n(r.d5),
      return20d: n(r.d20),
      return50d: n(r.d50),
      return100d: n(r.d100),
      return200d: n(r.d200),
    })
    .onConflictDoUpdate({
      target: [indexReturns.indexId, indexReturns.date, indexReturns.returnType],
      set: {
        return1d: n(r.d1),
        return1w: n(r.w1),
        return1m: n(r.m1),
        return3m: n(r.m3),
        return6m: n(r.m6),
        return1y: n(r.y1),
        return2y: n(r.y2),
        return3y: n(r.y3),
        return5y: n(r.y5),
        returnSinceInception: n(r.sinceInception),
        return5d: n(r.d5),
        return20d: n(r.d20),
        return50d: n(r.d50),
        return100d: n(r.d100),
        return200d: n(r.d200),
      },
    });

  await db
    .insert(indexDrawdowns)
    .values({
      indexId: c.indexId,
      date: c.asOf,
      returnType: c.returnType,
      currentClose: String(d.currentClose),
      allTimeHigh: String(d.ath),
      athDate: d.athDate,
      intradayAth: d.intradayAth != null ? String(d.intradayAth) : null,
      intradayAthDate: d.intradayAthDate,
      drawdownPercent: n(d.drawdownPercent)!,
      drawdownAmount: String(round(d.drawdownAmount, 4)),
      distanceFromAthPercent: n(d.distanceFromAthPercent)!,
      high52w: d.high52w != null ? String(d.high52w) : null,
      low52w: d.low52w != null ? String(d.low52w) : null,
      drawdown52wPercent: n(d.drawdown52wPercent),
      maxHistoricalDrawdown: n(h.maxHistoricalDrawdown),
      maxHistoricalDrawdownDate: h.maxHistoricalDrawdownDate,
      troughClose: String(h.currentTrough?.close ?? d.currentClose),
      troughDate: h.currentTrough?.date ?? d.athDate,
      recoveryFromTroughPct: n(h.recoveryFromTroughPct),
      daysBelow40: h.daysBelow(40),
      daysBelow30: h.daysBelow(30),
      priorDrawdowns30: h.priorDrawdowns30,
      priorDrawdowns40: h.priorDrawdowns40,
      priorDrawdowns50: h.priorDrawdowns50,
      avgRecoveryDays20: n(h.avgRecoveryDays20),
      avgRecoveryDays30: n(h.avgRecoveryDays30),
      avgRecoveryDays40: n(h.avgRecoveryDays40),
      avgRecoveryDays50: n(h.avgRecoveryDays50),
      drawdownPercentile: n(h.drawdownPercentile),
    })
    .onConflictDoUpdate({
      target: [indexDrawdowns.indexId, indexDrawdowns.date, indexDrawdowns.returnType],
      set: {
        currentClose: String(d.currentClose),
        allTimeHigh: String(d.ath),
        athDate: d.athDate,
        drawdownPercent: n(d.drawdownPercent)!,
        distanceFromAthPercent: n(d.distanceFromAthPercent)!,
        recoveryFromTroughPct: n(h.recoveryFromTroughPct),
        drawdownPercentile: n(h.drawdownPercentile),
      },
    });

  await db
    .insert(indexScores)
    .values({
      indexId: c.indexId,
      date: c.asOf,
      returnType: c.returnType,
      drawdownScore: n(c.scores.drawdown),
      drawdownScoreContinuous: n(c.scores.drawdownContinuous),
      momentumScore: n(c.scores.momentum),
      returnScore: n(c.scores.weakness),
      trendScore: n(c.scores.reversal),
      recoveryScore: n(c.scores.recovery),
      capitulationScore: n(c.scores.capitulation),
      weaknessScore: n(c.scores.weakness),
      relativeStrengthScore: n(c.scores.rs),
      opportunityScore: n(c.scores.opportunity),
      overallScore: n(c.scores.overall),
      classification: c.classification,
      trendState: c.mas.trendState,
      signal: c.signal,
      regime: c.regime,
      ma20: n(c.mas.ma20),
      ma50: n(c.mas.ma50),
      ma100: n(c.mas.ma100),
      ma200: n(c.mas.ma200),
      priceVs50: n(c.mas.priceVs50),
      priceVs100: n(c.mas.priceVs100),
      priceVs200: n(c.mas.priceVs200),
      ma50Slope: n(c.mas.ma50Slope),
      ma100Slope: n(c.mas.ma100Slope),
      ma200Slope: n(c.mas.ma200Slope),
      rs1mNifty50: n(c.rs.vs50.m1),
      rs3mNifty50: n(c.rs.vs50.m3),
      rs6mNifty50: n(c.rs.vs50.m6),
      rs1yNifty50: n(c.rs.vs50.y1),
      rs1mNifty500: n(c.rs.vs500.m1),
      rs3mNifty500: n(c.rs.vs500.m3),
      rs6mNifty500: n(c.rs.vs500.m6),
      rs1yNifty500: n(c.rs.vs500.y1),
      volatility20d: n(c.vol20),
      researchNote: c.researchNote,
    })
    .onConflictDoUpdate({
      target: [indexScores.indexId, indexScores.date, indexScores.returnType],
      set: {
        drawdownScore: n(c.scores.drawdown),
        recoveryScore: n(c.scores.recovery),
        opportunityScore: n(c.scores.opportunity),
        overallScore: n(c.scores.overall),
        classification: c.classification,
        signal: c.signal,
        researchNote: c.researchNote,
        ma50: n(c.mas.ma50),
        ma200: n(c.mas.ma200),
        priceVs50: n(c.mas.priceVs50),
        priceVs200: n(c.mas.priceVs200),
        rs1yNifty50: n(c.rs.vs50.y1),
        trendState: c.mas.trendState,
        regime: c.regime,
      },
    });
}
