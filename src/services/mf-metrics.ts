import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  indexPrices,
  indices,
  mutualFundBenchmarks,
  mutualFundHoldings,
  mutualFundNav,
  mutualFundReturns,
  mutualFundRisk,
  mutualFundRolling,
  mutualFundScores,
  mutualFundSip,
  mutualFunds,
} from "@/db/schema";
import { RISK_FREE_RATE, DEFAULT_SIP_AMOUNT } from "@/config/mf-defaults";
import { logger } from "@/lib/logger";
import { round } from "@/lib/utils";
import {
  annualizedVol,
  betaAlpha,
  calendarYearReturns,
  captureRatios,
  closestOnOrBefore,
  downsideDeviation,
  lumpsumResult,
  navDrawdown,
  periodStats,
  rollingCagr,
  sharpeRatio,
  sipResult,
  sortinoRatio,
  summarizeRolling,
  type NavPoint,
} from "@/mf/calculations";
import { classifyFund, partScores, researchScore } from "@/mf/scoring";
import { impliedSectorFromCategory, mapToNiftySector } from "@/mf/sector-map";
import { loadScannerRows } from "@/services/queries";
import { explainMarketReading, explanationToNote } from "@/services/explain";

function n(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v) || Math.abs(v) > 1_000_000) return null;
  return String(round(v, 6));
}

export async function recomputeMutualFunds(asOf?: string, opts?: { allPlans?: boolean }) {
  const db = getDb();
  let funds = await db.select().from(mutualFunds).where(eq(mutualFunds.active, true));
  if (!opts?.allPlans) {
    funds = funds.filter((f) => f.plan === "DIRECT" && f.option === "GROWTH");
  }
  funds.sort((a, b) => researchPriority(a) - researchPriority(b));
  const bench = await loadBenchmarkNav("NIFTY 50");
  const sectors = await loadScannerRows({ returnType: "PR", includeBenchmarks: true });
  const sectorByName = new Map(sectors.map((s) => [s.name.toUpperCase(), s]));
  const nifty = sectors.find((s) => s.symbol === "NIFTY50");
  const date = asOf ?? (await latestNavDate());
  if (!date) {
    logger.warn("No MF NAV in database — skip compute");
    return { computed: 0, asOf: null };
  }

  let computed = 0;
  for (const fund of funds) {
    const navs = await loadNav(fund.id, date);
    if (navs.length < 5) continue;
    try {
      await persistFundMetrics(fund, navs, date, bench, sectorByName, nifty?.regime ?? null);
      computed += 1;
      if (computed % 100 === 0) logger.info({ computed, scheme: fund.schemeCode }, "MF compute progress");
    } catch (err) {
      logger.warn({ err, scheme: fund.schemeCode }, "MF metric compute failed");
    }
  }
  await writeCategoryPercentiles(date);
  logger.info({ computed, asOf: date }, "Recomputed mutual fund metrics");
  return { computed, asOf: date };
}

function researchPriority(fund: typeof mutualFunds.$inferSelect) {
  return (fund.plan === "DIRECT" ? 0 : 2) + (fund.option === "GROWTH" ? 0 : 1);
}

async function writeCategoryPercentiles(asOf: string) {
  const db = getDb();
  const rows = await db
    .select({
      fundId: mutualFunds.id,
      category: mutualFunds.category,
      cagr5y: mutualFundReturns.cagr5y,
      sharpe: mutualFundRisk.sharpe,
      sortino: mutualFundRisk.sortino,
      maxDd: mutualFundRisk.maxDrawdown,
      consistency: mutualFundScores.consistencyScore,
      overall: mutualFundScores.overallScore,
    })
    .from(mutualFunds)
    .innerJoin(
      mutualFundScores,
      and(eq(mutualFundScores.fundId, mutualFunds.id), eq(mutualFundScores.date, asOf)),
    )
    .leftJoin(
      mutualFundReturns,
      and(eq(mutualFundReturns.fundId, mutualFunds.id), eq(mutualFundReturns.date, asOf)),
    )
    .leftJoin(
      mutualFundRisk,
      and(eq(mutualFundRisk.fundId, mutualFunds.id), eq(mutualFundRisk.date, asOf)),
    );

  const byCat = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byCat.get(r.category) ?? [];
    list.push(r);
    byCat.set(r.category, list);
  }

  const { percentileRank } = await import("@/mf/calculations");
  for (const group of byCat.values()) {
    const cagrs = group.map((g) => Number(g.cagr5y)).filter(Number.isFinite);
    const sharpes = group.map((g) => Number(g.sharpe)).filter(Number.isFinite);
    const sortinos = group.map((g) => Number(g.sortino)).filter(Number.isFinite);
    const dds = group.map((g) => Number(g.maxDd)).filter(Number.isFinite);
    const cons = group.map((g) => Number(g.consistency)).filter(Number.isFinite);
    for (const g of group) {
      const pct = {
        return5y: g.cagr5y != null ? percentileRank(Number(g.cagr5y), cagrs) : null,
        sharpe: g.sharpe != null ? percentileRank(Number(g.sharpe), sharpes) : null,
        sortino: g.sortino != null ? percentileRank(Number(g.sortino), sortinos) : null,
        drawdown: g.maxDd != null ? percentileRank(Number(g.maxDd), dds) : null,
        consistency: g.consistency != null ? percentileRank(Number(g.consistency), cons) : null,
        categorySize: group.length,
      };
      await db
        .update(mutualFundScores)
        .set({ categoryPercentiles: pct })
        .where(and(eq(mutualFundScores.fundId, g.fundId), eq(mutualFundScores.date, asOf)));
    }
  }
}

async function latestNavDate(): Promise<string | null> {
  const db = getDb();
  const r = await db.execute(sql`select max(date)::text as max from mutual_fund_nav`);
  const row = (r as unknown as { max?: string }[])[0];
  return row?.max ?? null;
}

async function loadNav(fundId: number, asOf: string): Promise<NavPoint[]> {
  const db = getDb();
  const rows = await db
    .select({ date: mutualFundNav.date, nav: mutualFundNav.nav })
    .from(mutualFundNav)
    .where(eq(mutualFundNav.fundId, fundId))
    .orderBy(asc(mutualFundNav.date));
  return rows
    .filter((r) => r.date <= asOf)
    .map((r) => ({ date: r.date, nav: Number(r.nav) }))
    .filter((r) => Number.isFinite(r.nav) && r.nav > 0);
}

async function loadBenchmarkNav(nseName: string): Promise<NavPoint[]> {
  const db = getDb();
  const [idx] = await db.select().from(indices).where(eq(indices.nseName, nseName)).limit(1);
  if (!idx) return [];
  const rows = await db
    .select({ date: indexPrices.date, close: indexPrices.close })
    .from(indexPrices)
    .where(and(eq(indexPrices.indexId, idx.id), eq(indexPrices.returnType, "PR")))
    .orderBy(asc(indexPrices.date));
  return rows.map((r) => ({ date: r.date, nav: Number(r.close) })).filter((r) => Number.isFinite(r.nav));
}

async function persistFundMetrics(
  fund: typeof mutualFunds.$inferSelect,
  navs: NavPoint[],
  asOf: string,
  bench: NavPoint[],
  sectorByName: Map<string, Awaited<ReturnType<typeof loadScannerRows>>[number]>,
  regime: string | null,
) {
  const db = getDb();
  const end = closestOnOrBefore(navs, asOf);
  if (!end) return;
  const p = {
    m1: periodStats(navs, asOf, 1 / 12),
    m3: periodStats(navs, asOf, 0.25),
    m6: periodStats(navs, asOf, 0.5),
    y1: periodStats(navs, asOf, 1),
    y2: periodStats(navs, asOf, 2),
    y3: periodStats(navs, asOf, 3),
    y5: periodStats(navs, asOf, 5),
    y7: periodStats(navs, asOf, 7),
    y10: periodStats(navs, asOf, 10),
  };
  const first = navs[0];
  const sinceAbs = first ? ((end.nav / first.nav) - 1) * 100 : null;
  const sinceYears = first ? (Date.parse(end.date) - Date.parse(first.date)) / (365.25 * 86_400_000) : 0;
  const sinceCagr = first && sinceYears >= 1 ? ((end.nav / first.nav) ** (1 / sinceYears) - 1) * 100 : sinceAbs;

  await db
    .insert(mutualFundReturns)
    .values({
      fundId: fund.id,
      date: asOf,
      return1m: n(p.m1.abs),
      return3m: n(p.m3.abs),
      return6m: n(p.m6.abs),
      return1y: n(p.y1.abs),
      return2y: n(p.y2.abs),
      return3y: n(p.y3.abs),
      return5y: n(p.y5.abs),
      return7y: n(p.y7.abs),
      return10y: n(p.y10.abs),
      returnSinceInception: n(sinceAbs),
      cagr2y: n(p.y2.cagr),
      cagr3y: n(p.y3.cagr),
      cagr5y: n(p.y5.cagr),
      cagr7y: n(p.y7.cagr),
      cagr10y: n(p.y10.cagr),
      cagrSinceInception: n(sinceCagr),
    })
    .onConflictDoUpdate({
      target: [mutualFundReturns.fundId, mutualFundReturns.date],
      set: { return1y: n(p.y1.abs), cagr3y: n(p.y3.cagr), cagr5y: n(p.y5.cagr), cagr10y: n(p.y10.cagr) },
    });

  const vol = annualizedVol(navs);
  const sharpe = sharpeRatio(p.y3.cagr ?? p.y1.abs, vol, RISK_FREE_RATE);
  const sortino = sortinoRatio(navs, p.y3.cagr ?? p.y1.abs, RISK_FREE_RATE);
  const dd = navDrawdown(navs);
  const ba = fund.assetClass === "Equity" || fund.assetClass === "Hybrid" || fund.assetClass === "Index Fund"
    ? betaAlpha(navs, bench, p.y3.cagr, periodStats(bench, asOf, 3).cagr, RISK_FREE_RATE)
    : { beta: null, alpha: null, treynor: null };
  const cap = fund.assetClass === "Equity" ? captureRatios(navs, bench) : { up: null, down: null };
  const calmar = dd && dd.maxDrawdown && p.y3.cagr != null && dd.maxDrawdown !== 0
    ? p.y3.cagr / Math.abs(dd.maxDrawdown)
    : null;
  const years = calendarYearReturns(navs);
  const worstCal = years.length ? Math.min(...years.map((y) => y.ret)) : null;
  const roll1 = rollingCagr(navs, 1, asOf);
  const worst1y = roll1.length ? Math.min(...roll1) : null;
  const roll3 = rollingCagr(navs, 3, asOf);
  const worst3y = roll3.length ? Math.min(...roll3) : null;

  await db
    .insert(mutualFundRisk)
    .values({
      fundId: fund.id,
      date: asOf,
      volatility: n(vol),
      standardDeviation: n(vol),
      beta: n(ba.beta),
      sharpe: n(sharpe),
      sortino: n(sortino),
      alpha: n(ba.alpha),
      treynor: n(ba.treynor),
      downsideDeviation: n(downsideDeviation(navs)),
      maxDrawdown: n(dd?.maxDrawdown ?? null),
      currentDrawdown: n(dd?.currentDrawdown ?? null),
      calmarRatio: n(calmar),
      upsideCapture: n(cap.up),
      downsideCapture: n(cap.down),
      recoveryDays: dd?.recoveryDays ?? null,
      worst1y: n(worst1y),
      worst3y: n(worst3y),
      worstCalendarYear: n(worstCal),
    })
    .onConflictDoUpdate({
      target: [mutualFundRisk.fundId, mutualFundRisk.date],
      set: { sharpe: n(sharpe), maxDrawdown: n(dd?.maxDrawdown ?? null), currentDrawdown: n(dd?.currentDrawdown ?? null) },
    });

  const sip = {
    y1: sipResult(navs, asOf, 1, DEFAULT_SIP_AMOUNT),
    y3: sipResult(navs, asOf, 3, DEFAULT_SIP_AMOUNT),
    y5: sipResult(navs, asOf, 5, DEFAULT_SIP_AMOUNT),
    y7: sipResult(navs, asOf, 7, DEFAULT_SIP_AMOUNT),
    y10: sipResult(navs, asOf, 10, DEFAULT_SIP_AMOUNT),
  };
  await db
    .insert(mutualFundSip)
    .values({
      fundId: fund.id,
      date: asOf,
      amount: String(DEFAULT_SIP_AMOUNT),
      frequency: "monthly",
      sip1yXirr: n(sip.y1?.xirr ?? null),
      sip3yXirr: n(sip.y3?.xirr ?? null),
      sip5yXirr: n(sip.y5?.xirr ?? null),
      sip7yXirr: n(sip.y7?.xirr ?? null),
      sip10yXirr: n(sip.y10?.xirr ?? null),
      payload: { y1: sip.y1, y3: sip.y3, y5: sip.y5, y10: sip.y10, lumpsum5y: lumpsumResult(navs, asOf, 5, 100000) },
    })
    .onConflictDoUpdate({
      target: [mutualFundSip.fundId, mutualFundSip.date, mutualFundSip.amount, mutualFundSip.frequency],
      set: { sip5yXirr: n(sip.y5?.xirr ?? null), sip10yXirr: n(sip.y10?.xirr ?? null) },
    });

  const roll5 = rollingCagr(navs, 5, asOf);
  const benchRoll3 = rollingCagr(bench, 3, asOf);
  const beat = roll3.length && benchRoll3.length
    ? (roll3.filter((v, i) => v > (benchRoll3[Math.min(i, benchRoll3.length - 1)] ?? 0)).length / roll3.length) * 100
    : null;
  for (const [years, values] of [[1, roll1], [3, roll3], [5, roll5]] as const) {
    const s = summarizeRolling(values);
    await db
      .insert(mutualFundRolling)
      .values({
        fundId: fund.id,
        date: asOf,
        windowYears: years,
        avg: n(s.avg),
        median: n(s.median),
        min: n(s.min),
        max: n(s.max),
        stdev: n(s.stdev),
        beatBenchmarkPct: years === 3 ? n(beat) : null,
        positivePct: values.length ? n((values.filter((v) => v > 0).length / values.length) * 100) : null,
      })
      .onConflictDoUpdate({
        target: [mutualFundRolling.fundId, mutualFundRolling.date, mutualFundRolling.windowYears],
        set: { avg: n(s.avg), beatBenchmarkPct: years === 3 ? n(beat) : null },
      });
  }

  const bench5 = periodStats(bench, asOf, 5).cagr;
  const excess5 = p.y5.cagr != null && bench5 != null ? p.y5.cagr - bench5 : null;
  for (const [period, fundR, benchR] of [
    ["1Y", p.y1.abs, periodStats(bench, asOf, 1).abs],
    ["3Y", p.y3.cagr, periodStats(bench, asOf, 3).cagr],
    ["5Y", p.y5.cagr, bench5],
  ] as const) {
    if (fundR == null || benchR == null) continue;
    await db
      .insert(mutualFundBenchmarks)
      .values({
        fundId: fund.id,
        date: asOf,
        benchmarkName: "NIFTY 50",
        fundReturn: n(fundR)!,
        benchmarkReturn: n(benchR)!,
        excessReturn: n(fundR - benchR)!,
        period,
      })
      .onConflictDoUpdate({
        target: [mutualFundBenchmarks.fundId, mutualFundBenchmarks.date, mutualFundBenchmarks.period, mutualFundBenchmarks.benchmarkName],
        set: { excessReturn: n(fundR - benchR)! },
      });
  }

  const holdings = await db
    .select()
    .from(mutualFundHoldings)
    .where(eq(mutualFundHoldings.fundId, fund.id))
    .orderBy(desc(mutualFundHoldings.date))
    .limit(80);
  const latestHoldDate = holdings[0]?.date;
  const latestHoldings = holdings.filter((h) => h.date === latestHoldDate);
  const exposure = latestHoldings.length
    ? aggregateHoldings(latestHoldings)
    : impliedSectorFromCategory(fund.category, fund.assetClass).map((x) => ({
        nseName: x.nseName,
        weight: x.weight,
        source: x.source,
      }));
  const alignment = sectorAlignment(exposure, sectorByName);

  const parts = partScores({
    cagr5y: p.y5.cagr,
    cagr3y: p.y3.cagr,
    sharpe,
    sortino,
    maxDrawdown: dd?.maxDrawdown ?? null,
    rollingBeatPct: beat,
    rollingStdev: summarizeRolling(roll3).stdev,
    excess5y: excess5,
    ter: null,
    top10: null,
    managerTenure: fund.managerTenureYears != null ? Number(fund.managerTenureYears) : null,
    aumCr: null,
    sectorAlignment: alignment.score,
  });
  const scored = researchScore(parts, fund.assetClass);
  const overall = scored.overall ?? 40;
  const classification = classifyFund(overall, dd?.maxDrawdown ?? null, sharpe);
  const signal = fundSignal(alignment, p.y1.abs, dd?.currentDrawdown ?? null);
  const note = researchNote(fund.schemeName, p, dd, sharpe, alignment, classification, signal, fund.category, overall);

  await db
    .insert(mutualFundScores)
    .values({
      fundId: fund.id,
      date: asOf,
      returnScore: n(parts.returnScore),
      riskScore: n(parts.riskScore),
      consistencyScore: n(parts.consistencyScore),
      drawdownScore: n(parts.drawdownScore),
      expenseScore: n(parts.expenseScore),
      benchmarkScore: n(parts.benchmarkScore),
      portfolioScore: n(parts.portfolioScore),
      managerScore: n(parts.managerScore),
      downsideScore: n(parts.drawdownScore),
      marketCycleScore: n(regime === "BULL" ? 60 : regime === "BEAR" ? 40 : 50),
      sectorAlignmentScore: n(parts.sectorAlignmentScore),
      overallScore: n(overall),
      classification,
      signal,
      explanation: { parts: scored.used, alignment: alignment.items, why: scored.used.slice(0, 4) },
      researchNote: note,
    })
    .onConflictDoUpdate({
      target: [mutualFundScores.fundId, mutualFundScores.date],
      set: { overallScore: n(overall), classification, signal, researchNote: note },
    });
  void latestHoldings;
}

function aggregateHoldings(rows: { sector: string | null; weight: string | null }[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const nse = r.sector ? mapToNiftySector(r.sector) : null;
    if (!nse) continue;
    map.set(nse, (map.get(nse) ?? 0) + Number(r.weight ?? 0));
  }
  return [...map.entries()].map(([nseName, weight]) => ({ nseName, weight, source: "holdings" as const }));
}

function sectorAlignment(
  exposure: { nseName: string; weight: number; source: string }[],
  sectorByName: Map<string, Awaited<ReturnType<typeof loadScannerRows>>[number]>,
) {
  const items = exposure.map((e) => {
    const row =
      sectorByName.get(e.nseName.toUpperCase()) ??
      [...sectorByName.values()].find((s) => s.name.toUpperCase() === e.nseName.toUpperCase() || s.name.toUpperCase().includes(e.nseName.replace("NIFTY ", "")));
    return {
      ...e,
      drawdown: row?.distanceFromAth ?? null,
      return1y: row?.return1y ?? null,
      recoveryScore: row?.recoveryScore ?? null,
      signal: row?.signal ?? null,
      classification: row?.classification ?? null,
    };
  });
  if (!items.length) return { score: null as number | null, items };
  let acc = 0;
  let w = 0;
  for (const it of items) {
    const rec = it.recoveryScore ?? 40;
    const falling = it.signal === "FALLING_KNIFE" ? -15 : it.signal === "EARLY_RECOVERY" ? 15 : 0;
    acc += (rec + falling) * it.weight;
    w += it.weight;
  }
  return { score: w ? acc / w : null, items };
}

function fundSignal(
  alignment: ReturnType<typeof sectorAlignment>,
  ret1y: number | null,
  currentDd: number | null,
) {
  const falling = alignment.items.some((i) => i.signal === "FALLING_KNIFE" && i.weight >= 15);
  const recovering = alignment.items.some((i) => (i.signal === "EARLY_RECOVERY" || i.signal === "RECOVERING") && i.weight >= 15);
  if (falling && (ret1y ?? 0) < 0 && (currentDd ?? 0) > 15) return "FALLING_KNIFE";
  if (recovering && (ret1y ?? -99) > -5) return "EARLY_RECOVERY_FUND";
  if (alignment.items.some((i) => (i.drawdown ?? 0) >= 40 && i.weight >= 15)) return "CONTRARIAN_RESEARCH";
  return "RESEARCH";
}

function researchNote(
  name: string,
  p: Record<string, { abs: number | null; cagr: number | null }>,
  dd: ReturnType<typeof navDrawdown>,
  sharpe: number | null,
  alignment: ReturnType<typeof sectorAlignment>,
  classification: string,
  signal: string,
  category: string,
  overall: number,
) {
  return explanationToNote(
    explainMarketReading({
      kind: "FUND",
      name,
      signal,
      classification,
      category,
      return1y: p.y1.abs,
      return3y: p.y3.cagr,
      return5y: p.y5.cagr,
      drawdown: dd?.currentDrawdown ?? null,
      maxDrawdown: dd?.maxDrawdown ?? null,
      sharpe,
      overallScore: overall,
      related: alignment.items.map((i) => ({
        name: i.nseName,
        weight: i.weight,
        signal: i.signal,
        return1y: i.return1y,
        drawdown: i.drawdown,
        source: i.source,
      })),
    }),
  );
}
