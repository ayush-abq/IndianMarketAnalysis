import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  mutualFundAum,
  mutualFundExpenses,
  mutualFundFreshness,
  mutualFundHoldings,
  mutualFundNav,
  mutualFundPortfolio,
  mutualFundReturns,
  mutualFundRisk,
  mutualFundRolling,
  mutualFundScores,
  mutualFundSip,
  mutualFunds,
} from "@/db/schema";
import { sipResult, lumpsumResult, type NavPoint } from "@/mf/calculations";
import { overlapHoldings } from "@/mf/calculations";
import { impliedSectorFromCategory, mapToNiftySector } from "@/mf/sector-map";
import { loadScannerRows } from "@/services/queries";
import { buildDashboard } from "@/services/queries";
import { explainMarketReading, whySummary } from "@/services/explain";

export type MfRow = {
  id: number;
  schemeName: string;
  amcName: string | null;
  schemeCode: string;
  plan: string;
  option: string;
  assetClass: string;
  category: string;
  nav: number | null;
  navDate: string | null;
  return1m: number | null;
  return3m: number | null;
  return6m: number | null;
  return1y: number | null;
  cagr3y: number | null;
  cagr5y: number | null;
  cagr10y: number | null;
  return10y: number | null;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number | null;
  currentDrawdown: number | null;
  expenseRatio: number | null;
  aum: number | null;
  sip5y: number | null;
  sip10y: number | null;
  consistency: number | null;
  overallScore: number | null;
  classification: string | null;
  signal: string | null;
  researchNote: string | null;
  whyShort: string;
};

function num(v: string | null | undefined) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function latestMfDate() {
  const db = getDb();
  const r = await db.execute(sql`select max(date)::text as max from mutual_fund_scores`);
  return (r as unknown as { max?: string }[])[0]?.max ?? null;
}

export async function loadFundRows(opts: {
  plan?: string;
  option?: string;
  assetClass?: string;
  category?: string;
  signal?: string;
  q?: string;
  minScore?: number;
  minHistoryYears?: number;
  indexOnly?: boolean;
  amc?: string;
  asOf?: string;
  horizon?: string;
  riskProfile?: string;
} = {}): Promise<MfRow[]> {
  const db = getDb();
  const asOf = opts.asOf ?? (await latestMfDate());
  if (!asOf) return [];

  const rows = await db
    .select({
      f: mutualFunds,
      ret: mutualFundReturns,
      risk: mutualFundRisk,
      sc: mutualFundScores,
      sip: mutualFundSip,
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
    )
    .leftJoin(
      mutualFundSip,
      and(eq(mutualFundSip.fundId, mutualFunds.id), eq(mutualFundSip.date, asOf)),
    )
    .where(eq(mutualFunds.active, true));

  const latestNav = await db.execute(sql`
    select distinct on (fund_id) fund_id, nav, date
    from mutual_fund_nav
    order by fund_id, date desc
  `);
  const latestTer = await db.execute(sql`
    select distinct on (fund_id) fund_id, expense_ratio
    from mutual_fund_expenses
    order by fund_id, date desc
  `);
  const latestAum = await db.execute(sql`
    select distinct on (fund_id) fund_id, aum
    from mutual_fund_aum
    order by fund_id, date desc
  `);

  const navMap = new Map<number, { nav: number; date: string }>();
  for (const r of latestNav as unknown as { fund_id: number; nav: string; date: string }[]) {
    navMap.set(Number(r.fund_id), { nav: Number(r.nav), date: r.date });
  }
  const terMap = new Map<number, number>();
  for (const r of latestTer as unknown as { fund_id: number; expense_ratio: string }[]) {
    terMap.set(Number(r.fund_id), Number(r.expense_ratio));
  }
  const aumMap = new Map<number, number>();
  for (const r of latestAum as unknown as { fund_id: number; aum: string }[]) {
    aumMap.set(Number(r.fund_id), Number(r.aum));
  }

  let mapped: MfRow[] = rows.map((r) => {
    const nav = navMap.get(r.f.id);
    return {
      id: r.f.id,
      schemeName: r.f.schemeName,
      amcName: r.f.amcName,
      schemeCode: r.f.schemeCode,
      plan: r.f.plan,
      option: r.f.option,
      assetClass: r.f.assetClass,
      category: r.f.category,
      nav: nav?.nav ?? null,
      navDate: nav?.date ?? null,
      return1m: num(r.ret?.return1m),
      return3m: num(r.ret?.return3m),
      return6m: num(r.ret?.return6m),
      return1y: num(r.ret?.return1y),
      cagr3y: num(r.ret?.cagr3y),
      cagr5y: num(r.ret?.cagr5y),
      cagr10y: num(r.ret?.cagr10y),
      return10y: num(r.ret?.return10y),
      sharpe: num(r.risk?.sharpe),
      sortino: num(r.risk?.sortino),
      maxDrawdown: num(r.risk?.maxDrawdown),
      currentDrawdown: num(r.risk?.currentDrawdown),
      expenseRatio: terMap.get(r.f.id) ?? null,
      aum: aumMap.get(r.f.id) ?? null,
      sip5y: num(r.sip?.sip5yXirr),
      sip10y: num(r.sip?.sip10yXirr),
      consistency: num(r.sc.consistencyScore),
      overallScore: num(r.sc.overallScore),
      classification: r.sc.classification,
      signal: r.sc.signal,
      researchNote: r.sc.researchNote,
      whyShort: whySummary(
        explainMarketReading({
          kind: "FUND",
          name: r.f.schemeName,
          signal: r.sc.signal,
          classification: r.sc.classification,
          category: r.f.category,
          return1y: num(r.ret?.return1y),
          return3y: num(r.ret?.cagr3y),
          return5y: num(r.ret?.cagr5y),
          drawdown: num(r.risk?.currentDrawdown),
          maxDrawdown: num(r.risk?.maxDrawdown),
          sharpe: num(r.risk?.sharpe),
          consistency: num(r.sc.consistencyScore),
          overallScore: num(r.sc.overallScore),
        }),
      ),
    };
  });

  if (opts.plan) mapped = mapped.filter((r) => r.plan === opts.plan);
  if (opts.option) mapped = mapped.filter((r) => r.option === opts.option);
  if (opts.assetClass) mapped = mapped.filter((r) => r.assetClass === opts.assetClass);
  if (opts.category) mapped = mapped.filter((r) => r.category.toLowerCase().includes(opts.category!.toLowerCase()));
  if (opts.signal) mapped = mapped.filter((r) => r.signal === opts.signal);
  if (opts.q) {
    const q = opts.q.toLowerCase();
    mapped = mapped.filter(
      (r) =>
        r.schemeName.toLowerCase().includes(q) ||
        (r.amcName ?? "").toLowerCase().includes(q) ||
        r.schemeCode.includes(q) ||
        r.category.toLowerCase().includes(q),
    );
  }
  if (opts.indexOnly) mapped = mapped.filter((r) => r.assetClass === "Index Fund" || r.assetClass === "ETF");
  if (opts.amc) mapped = mapped.filter((r) => (r.amcName ?? "").toLowerCase().includes(opts.amc!.toLowerCase()));
  if (opts.minScore != null) mapped = mapped.filter((r) => (r.overallScore ?? 0) >= opts.minScore!);
  mapped = applyHorizonRisk(mapped, opts.horizon, opts.riskProfile);
  mapped.sort((a, b) => rankForHorizon(b, opts.horizon) - rankForHorizon(a, opts.horizon));
  return mapped;
}

function applyHorizonRisk(rows: MfRow[], horizon?: string, risk?: string) {
  let out = rows;
  if (horizon === "lt1" || horizon === "<1 year") {
    out = out.filter(
      (r) =>
        r.assetClass === "Debt" ||
        /arbitrage|liquid|overnight|money market|ultra short|low duration/i.test(r.category),
    );
  } else if (horizon === "1-3") {
    out = out.filter((r) => r.assetClass !== "Equity" || /large cap|index|etf|flexi|hybrid/i.test(`${r.category} ${r.assetClass}`));
  }
  if (risk === "Conservative") {
    out = out.filter((r) => r.assetClass === "Debt" || /conservative|arbitrage|equity savings/i.test(r.category));
  } else if (risk === "Moderate") {
    out = out.filter((r) => r.assetClass !== "Equity" || /large cap|flexi|multi cap|index|etf|hybrid/i.test(`${r.category} ${r.assetClass}`));
  } else if (risk === "Aggressive") {
    out = out.filter((r) => r.assetClass !== "Debt" || /dynamic|credit/i.test(r.category));
  }
  return out;
}

function rankForHorizon(row: MfRow, horizon?: string) {
  if (horizon === "10+" || horizon === "7-10" || horizon === "5-7") {
    return (row.consistency ?? 0) * 0.35 + (row.cagr5y ?? 0) * 1.5 + (100 + (row.maxDrawdown ?? -40)) * 0.3 + (row.overallScore ?? 0) * 0.4;
  }
  if (horizon === "lt1" || horizon === "<1 year" || horizon === "1-3") {
    return (100 + (row.maxDrawdown ?? -20)) * 0.5 + (row.sharpe ?? 0) * 20 + (row.overallScore ?? 0) * 0.2;
  }
  return row.overallScore ?? 0;
}

export async function mfDashboard() {
  const defaultRows = await loadFundRows({ plan: "DIRECT", option: "GROWTH" });
  const all = defaultRows.length ? defaultRows : await loadFundRows();
  const nse = await buildDashboard("PR");
  const pick = (pred: (r: MfRow) => boolean) =>
    all.filter(pred).sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))[0] ?? null;
  const top = (pred: (r: MfRow) => boolean, n = 10) => all.filter(pred).slice(0, n);
  return {
    asOf: await latestMfDate(),
    totals: {
      schemes: all.length,
      equity: all.filter((r) => r.assetClass === "Equity").length,
      debt: all.filter((r) => r.assetClass === "Debt").length,
      hybrid: all.filter((r) => r.assetClass === "Hybrid").length,
    },
    market: {
      regime: nse.regime,
      below30: nse.totals.below30,
      below40: nse.totals.below40,
      recovering: nse.totals.recoveryCandidates,
      falling: nse.totals.fallingKnives,
      implication:
        nse.totals.below40 > 0
          ? "Some NSE sectors remain deeply below ATH. Equity funds with those exposures need drawdown and recovery context, not return chasing."
          : "Few sectors are in extreme drawdown. Quality, cost, and consistency screens remain the primary research filters.",
    },
    cards: {
      bestResearch: all.find((r) => r.assetClass === "Equity") ?? all[0] ?? null,
      bestSip: [...all].sort((a, b) => (b.sip5y ?? -99) - (a.sip5y ?? -99))[0] ?? null,
      largeCap: pick((r) => /large cap/i.test(r.category) && !/mid|small/i.test(r.category)),
      flexiCap: pick((r) => /flexi/i.test(r.category)),
      midCap: pick((r) => /mid cap/i.test(r.category) && !/large/i.test(r.category)),
      smallCap: pick((r) => /small cap/i.test(r.category)),
      index: pick((r) => r.assetClass === "Index Fund" || r.assetClass === "ETF"),
      hybrid: pick((r) => r.assetClass === "Hybrid"),
      debt: pick((r) => r.assetClass === "Debt"),
    },
    lists: {
      research: top(() => true),
      sip: [...all].sort((a, b) => (b.sip5y ?? -99) - (a.sip5y ?? -99)).slice(0, 10),
      recovery: top((r) => r.signal === "EARLY_RECOVERY_FUND"),
      falling: top((r) => r.signal === "FALLING_KNIFE"),
      index: top((r) => r.assetClass === "Index Fund" || r.assetClass === "ETF"),
      quality: top((r) => (r.sharpe ?? 0) > 0.6 && (r.maxDrawdown ?? -99) > -35 && (r.consistency ?? 0) > 55),
    },
  };
}

export async function getFundDetail(id: number) {
  const db = getDb();
  const [fund] = await db.select().from(mutualFunds).where(eq(mutualFunds.id, id)).limit(1);
  if (!fund) return null;
  const rows = await loadFundRows();
  const snapshot = rows.find((r) => r.id === id) ?? null;
  const [fresh] = await db.select().from(mutualFundFreshness).where(eq(mutualFundFreshness.fundId, id)).limit(1);
  const [score] = await db.select().from(mutualFundScores).where(eq(mutualFundScores.fundId, id)).orderBy(desc(mutualFundScores.date)).limit(1);
  const [risk] = await db.select().from(mutualFundRisk).where(eq(mutualFundRisk.fundId, id)).orderBy(desc(mutualFundRisk.date)).limit(1);
  const [ret] = await db.select().from(mutualFundReturns).where(eq(mutualFundReturns.fundId, id)).orderBy(desc(mutualFundReturns.date)).limit(1);
  const [sip] = await db.select().from(mutualFundSip).where(eq(mutualFundSip.fundId, id)).orderBy(desc(mutualFundSip.date)).limit(1);
  const rolling = await db.select().from(mutualFundRolling).where(eq(mutualFundRolling.fundId, id));
  const holdings = await db.select().from(mutualFundHoldings).where(eq(mutualFundHoldings.fundId, id)).orderBy(desc(mutualFundHoldings.date)).limit(50);
  const [portfolio] = await db.select().from(mutualFundPortfolio).where(eq(mutualFundPortfolio.fundId, id)).orderBy(desc(mutualFundPortfolio.date)).limit(1);
  const [expense] = await db.select().from(mutualFundExpenses).where(eq(mutualFundExpenses.fundId, id)).orderBy(desc(mutualFundExpenses.date)).limit(1);
  const [aum] = await db.select().from(mutualFundAum).where(eq(mutualFundAum.fundId, id)).orderBy(desc(mutualFundAum.date)).limit(1);
  const sectors = await fundSectorContext(fund, holdings);
  const explanation = explainMarketReading({
    kind: "FUND",
    name: fund.schemeName,
    signal: score?.signal ?? snapshot?.signal,
    classification: score?.classification ?? snapshot?.classification,
    category: fund.category,
    return1y: snapshot?.return1y ?? num(ret?.return1y),
    return3y: snapshot?.cagr3y ?? num(ret?.cagr3y),
    return5y: snapshot?.cagr5y ?? num(ret?.cagr5y),
    drawdown: snapshot?.currentDrawdown ?? num(risk?.currentDrawdown),
    maxDrawdown: snapshot?.maxDrawdown ?? num(risk?.maxDrawdown),
    sharpe: snapshot?.sharpe ?? num(risk?.sharpe),
    consistency: snapshot?.consistency ?? num(score?.consistencyScore),
    overallScore: snapshot?.overallScore ?? num(score?.overallScore),
    related: sectors.map((s) => ({
      name: s.sectorName ?? s.nseName,
      weight: s.weight,
      signal: s.signal,
      return1y: s.return1y,
      drawdown: s.drawdown,
      source: s.source,
    })),
  });
  return {
    fund,
    snapshot,
    fresh,
    score,
    risk,
    returns: ret,
    sip,
    rolling,
    holdings,
    portfolio,
    expense,
    aum,
    sectors,
    explanation,
  };
}

export async function fundSectorContext(
  fund: { category: string; assetClass: string },
  holdings: { sector: string | null; weight: string | null; date: string }[],
) {
  const scanner = await loadScannerRows({ returnType: "PR", includeBenchmarks: true });
  const latest = holdings[0]?.date;
  const current = holdings.filter((h) => h.date === latest);
  const implied = current.length
    ? Object.entries(
        current.reduce<Record<string, number>>((acc, h) => {
          const nse = h.sector ? mapToNiftySector(h.sector) : null;
          if (nse) acc[nse] = (acc[nse] ?? 0) + Number(h.weight ?? 0);
          return acc;
        }, {}),
      ).map(([nseName, weight]) => ({ nseName, weight, source: "holdings" as const }))
    : impliedSectorFromCategory(fund.category, fund.assetClass);
  return implied.map((e) => {
    const row = scanner.find((s) => s.name.toUpperCase() === e.nseName.replace("NIFTY ", "NIFTY ").toUpperCase() || s.name.toUpperCase().includes(e.nseName.replace("NIFTY ", "")));
    return {
      ...e,
      sectorName: row?.name ?? e.nseName,
      indexId: row?.indexId ?? null,
      drawdown: row?.distanceFromAth ?? null,
      return1y: row?.return1y ?? null,
      return2y: row?.return2y ?? null,
      return5y: row?.return5y ?? null,
      recoveryScore: row?.recoveryScore ?? null,
      opportunityScore: row?.opportunityScore ?? null,
      signal: row?.signal ?? null,
      classification: row?.classification ?? null,
    };
  });
}

export async function fundsForSector(nseName: string) {
  const rows = await loadFundRows({ plan: "DIRECT", option: "GROWTH" });
  const scanner = await loadScannerRows({ returnType: "PR" });
  const sector = scanner.find((s) => s.name.toUpperCase().includes(nseName.toUpperCase().replace("NIFTY ", "")));
  const matched = [];
  for (const row of rows) {
    const detailSectors = impliedSectorFromCategory(row.category, row.assetClass);
    const hit = detailSectors.find((s) => s.nseName.toUpperCase().includes(nseName.toUpperCase().replace("NIFTY ", "")) || nseName.toUpperCase().includes(s.nseName.replace("NIFTY ", "")));
    if (hit) matched.push({ ...row, exposure: hit.weight });
  }
  return { sector, funds: matched.slice(0, 40) };
}

export async function compareFunds(ids: number[]) {
  const rows = await loadFundRows();
  return rows.filter((r) => ids.includes(r.id));
}

export async function computeSipOnDemand(fundId: number, amount: number, frequency: "monthly" | "quarterly") {
  const db = getDb();
  const rows = await db
    .select()
    .from(mutualFundNav)
    .where(eq(mutualFundNav.fundId, fundId))
    .orderBy(asc(mutualFundNav.date));
  const navs: NavPoint[] = rows.map((r) => ({ date: r.date, nav: Number(r.nav) }));
  const asOf = navs.at(-1)?.date;
  if (!asOf) return null;
  return {
    y1: sipResult(navs, asOf, 1, amount, frequency),
    y3: sipResult(navs, asOf, 3, amount, frequency),
    y5: sipResult(navs, asOf, 5, amount, frequency),
    y7: sipResult(navs, asOf, 7, amount, frequency),
    y10: sipResult(navs, asOf, 10, amount, frequency),
    lumpsum: [1, 3, 5, 7, 10].map((y) => lumpsumResult(navs, asOf, y, 100000)),
  };
}

export async function loadNavSeries(fundId: number) {
  const db = getDb();
  return db.select().from(mutualFundNav).where(eq(mutualFundNav.fundId, fundId)).orderBy(asc(mutualFundNav.date));
}

export async function overlapForFunds(ids: number[]) {
  const db = getDb();
  const sets = [];
  for (const id of ids) {
    const hs = await db.select().from(mutualFundHoldings).where(eq(mutualFundHoldings.fundId, id));
    const date = hs[0]?.date;
    sets.push(
      hs
        .filter((h) => h.date === date)
        .map((h) => ({
          isin: h.isin,
          securityName: h.securityName,
          weight: Number(h.weight ?? 0),
        })),
    );
  }
  if (sets.length < 2 || sets.some((s) => !s.length)) {
    return { overlapPct: null, common: [], note: "Holdings not available from official daily NAV files. Configure a licensed portfolio feed or official AMC monthly file." };
  }
  return overlapHoldings(sets[0], sets[1]);
}

export async function searchFunds(q: string) {
  const db = getDb();
  return db
    .select()
    .from(mutualFunds)
    .where(
      or(
        ilike(mutualFunds.schemeName, `%${q}%`),
        ilike(mutualFunds.amcName, `%${q}%`),
        ilike(mutualFunds.schemeCode, `%${q}%`),
        ilike(mutualFunds.isin, `%${q}%`),
        ilike(mutualFunds.category, `%${q}%`),
      ),
    )
    .limit(50);
}

export async function mfHealth() {
  const db = getDb();
  const nav = await db.execute(sql`select count(*)::int as n, max(date)::text as latest from mutual_fund_nav`);
  const funds = await db.execute(sql`select count(*)::int as n from mutual_funds`);
  const scores = await db.execute(sql`select count(*)::int as n, max(date)::text as latest from mutual_fund_scores`);
  const last = await db.execute(sql`
    select status, completed_at, records_downloaded, records_inserted, error_message
    from data_ingestion_runs
    where provider in ('AMFI','MF_LICENSED')
    order by started_at desc
    limit 1
  `);
  return {
    funds: (funds as unknown as { n: number }[])[0],
    nav: (nav as unknown as { n: number; latest: string }[])[0],
    scores: (scores as unknown as { n: number; latest: string }[])[0],
    lastRun: (last as unknown as object[])[0] ?? null,
    source: "Official AMFI NAV files → local PostgreSQL → precomputed scores",
  };
}
