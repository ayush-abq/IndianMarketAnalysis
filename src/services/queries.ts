import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  dataIngestionRuns,
  indexDrawdowns,
  indexPrices,
  indexReturns,
  indexScores,
  indices,
} from "@/db/schema";
import { signalLabel, type ResearchSignal } from "@/scoring/signals";
import type { DashboardSummary, ScannerRow } from "@/lib/types";
import { getSettings } from "@/services/settings";
import { isSectorResearchIndex } from "@/lib/universe-filter";
import { explainIndexRow, whySummary } from "@/services/explain";
import { technicalOverview } from "@/scoring/technical-stance";

function n(v: string | null | undefined): number | null {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function latestMetricDate(returnType: "PR" | "TR" = "PR"): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ date: indexScores.date })
    .from(indexScores)
    .where(eq(indexScores.returnType, returnType))
    .orderBy(desc(indexScores.date))
    .limit(1);
  return rows[0]?.date ?? null;
}

export async function loadScannerRows(opts: {
  asOf?: string;
  returnType?: "PR" | "TR";
  includeBenchmarks?: boolean;
}): Promise<ScannerRow[]> {
  const db = getDb();
  const returnType = opts.returnType ?? "PR";
  const asOf = opts.asOf ?? (await latestMetricDate(returnType));
  if (!asOf) return [];

  const rows = await db
    .select({
      index: indices,
      ret: indexReturns,
      dd: indexDrawdowns,
      sc: indexScores,
    })
    .from(indices)
    .innerJoin(
      indexScores,
      and(
        eq(indexScores.indexId, indices.id),
        eq(indexScores.date, asOf),
        eq(indexScores.returnType, returnType),
      ),
    )
    .innerJoin(
      indexDrawdowns,
      and(
        eq(indexDrawdowns.indexId, indices.id),
        eq(indexDrawdowns.date, asOf),
        eq(indexDrawdowns.returnType, returnType),
      ),
    )
    .innerJoin(
      indexReturns,
      and(
        eq(indexReturns.indexId, indices.id),
        eq(indexReturns.date, asOf),
        eq(indexReturns.returnType, returnType),
      ),
    )
    .where(eq(indices.active, true));

  const mapped: ScannerRow[] = rows
    .filter((r) => {
      if (r.index.isBenchmark) return Boolean(opts.includeBenchmarks);
      return isSectorResearchIndex({
        name: r.index.name,
        category: r.index.category,
        isBenchmark: r.index.isBenchmark,
        nseName: r.index.nseName,
      });
    })
    .map((r) => {
      const signal = (r.sc.signal ?? "NOT_QUALIFYING") as ResearchSignal;
      const explanation = explainIndexRow({
        name: r.index.name,
        signal,
        classification: r.sc.classification,
        return1m: n(r.ret.return1m),
        return3m: n(r.ret.return3m),
        return1y: n(r.ret.return1y),
        return2y: n(r.ret.return2y),
        return5y: n(r.ret.return5y),
        priceVs50: n(r.sc.priceVs50),
        priceVs200: n(r.sc.priceVs200),
        rs1yNifty50: n(r.sc.rs1yNifty50),
        distanceFromAth: Number(r.dd.distanceFromAthPercent),
        recoveryScore: Number(r.sc.recoveryScore ?? 0),
        trendState: r.sc.trendState,
      });
      return {
        rank: 0,
        indexId: r.index.id,
        name: r.index.name,
        symbol: r.index.symbol,
        category: r.index.category,
        current: Number(r.dd.currentClose),
        change1d: n(r.ret.return1d),
        ath: Number(r.dd.allTimeHigh),
        athDate: r.dd.athDate,
        closingAth: Number(r.dd.allTimeHigh),
        closingAthDate: r.dd.athDate,
        intradayAth: n(r.dd.intradayAth),
        distanceFromAth: Number(r.dd.distanceFromAthPercent),
        drawdownPercent: Number(r.dd.drawdownPercent),
        bucket: r.sc.classification,
        return1d: n(r.ret.return1d),
        return1w: n(r.ret.return1w),
        return1m: n(r.ret.return1m),
        return3m: n(r.ret.return3m),
        return6m: n(r.ret.return6m),
        return1y: n(r.ret.return1y),
        return2y: n(r.ret.return2y),
        return3y: n(r.ret.return3y),
        return5y: n(r.ret.return5y),
        ma50: n(r.sc.ma50),
        ma200: n(r.sc.ma200),
        priceVs50: n(r.sc.priceVs50),
        priceVs200: n(r.sc.priceVs200),
        rs1yNifty50: n(r.sc.rs1yNifty50),
        rs1mNifty50: n(r.sc.rs1mNifty50),
        rs3mNifty50: n(r.sc.rs3mNifty50),
        rs6mNifty50: n(r.sc.rs6mNifty50),
        recoveryScore: Number(r.sc.recoveryScore ?? 0),
        opportunityScore: Number(r.sc.opportunityScore ?? 0),
        overallScore: Number(r.sc.overallScore ?? 0),
        weaknessScore: n(r.sc.weaknessScore),
        classification: r.sc.classification,
        signal,
        signalLabel: signalLabel(signal),
        trendState: r.sc.trendState,
        regime: r.sc.regime,
        returnType,
        researchNote: r.sc.researchNote,
        explanation,
        whyShort: whySummary(explanation),
        isBenchmark: r.index.isBenchmark,
        technical: technicalOverview({
          priceVs50: n(r.sc.priceVs50),
          priceVs200: n(r.sc.priceVs200),
          return1m: n(r.ret.return1m),
          return3m: n(r.ret.return3m),
          trendState: r.sc.trendState,
        }),
      };
    });

  mapped.sort((a, b) => b.distanceFromAth - a.distanceFromAth);
  return mapped.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function buildDashboard(returnType: "PR" | "TR" = "PR"): Promise<DashboardSummary> {
  const rows = await loadScannerRows({ returnType });
  const settings = await getSettings();
  const db = getDb();
  const lastOk = await db
    .select()
    .from(dataIngestionRuns)
    .where(eq(dataIngestionRuns.status, "success"))
    .orderBy(desc(dataIngestionRuns.completedAt))
    .limit(1);
  const lastAny = await db
    .select()
    .from(dataIngestionRuns)
    .orderBy(desc(dataIngestionRuns.startedAt))
    .limit(1);
  const asOf = rows[0] ? (await latestMetricDate(returnType)) : null;
  const latestPrice = await db
    .select({ date: indexPrices.date })
    .from(indexPrices)
    .orderBy(desc(indexPrices.date))
    .limit(1);

  const sectors = rows.filter((r) => !r.isBenchmark);
  const take = (list: ScannerRow[]) => list.slice(0, 10);
  const stale =
    lastAny[0]?.status === "failed" ||
    (asOf != null && latestPrice[0]?.date != null && latestPrice[0].date < asOf);

  let regime = sectors[0]?.regime ?? null;
  try {
    const { latestMarketContext } = await import("@/services/market-context");
    const ctx = await latestMarketContext();
    if (ctx && "regime" in ctx && ctx.regime) regime = ctx.regime;
  } catch {
    /* keep per-index regime */
  }

  return {
    asOf,
    lastSuccessfulUpdate: lastOk[0]?.completedAt?.toISOString() ?? null,
    dataThrough: latestPrice[0]?.date ?? asOf,
    stale,
    provider: lastOk[0]?.provider ?? settings.benchmark,
    returnType,
    regime,
    totals: {
      indices: sectors.length,
      below30: sectors.filter((r) => r.distanceFromAth >= 30).length,
      below40: sectors.filter((r) => r.distanceFromAth >= 40).length,
      below50: sectors.filter((r) => r.distanceFromAth >= 50).length,
      neg1y: sectors.filter((r) => (r.return1y ?? 1) < 0).length,
      neg2y: sectors.filter((r) => (r.return2y ?? 1) < 0).length,
      neg5y: sectors.filter((r) => (r.return5y ?? 1) < 0).length,
      recoveryCandidates: sectors.filter((r) => r.signal === "EARLY_RECOVERY" || r.signal === "RECOVERING").length,
      fallingKnives: sectors.filter((r) => r.signal === "FALLING_KNIFE").length,
      structural: sectors.filter((r) => r.signal === "STRUCTURAL_WEAKNESS").length,
    },
    lists: {
      beatenDown: take([...sectors].sort((a, b) => b.distanceFromAth - a.distanceFromAth)),
      worst1y: take([...sectors].filter((r) => r.return1y != null).sort((a, b) => (a.return1y ?? 0) - (b.return1y ?? 0))),
      worst2y: take([...sectors].filter((r) => r.return2y != null).sort((a, b) => (a.return2y ?? 0) - (b.return2y ?? 0))),
      worst5y: take([...sectors].filter((r) => r.return5y != null).sort((a, b) => (a.return5y ?? 0) - (b.return5y ?? 0))),
      extreme: take(sectors.filter((r) => r.distanceFromAth >= 50)),
      recoveries: take(
        [...sectors]
          .filter((r) => r.signal === "EARLY_RECOVERY" || r.signal === "RECOVERING")
          .sort((a, b) => b.recoveryScore - a.recoveryScore),
      ),
      fallingKnives: take(sectors.filter((r) => r.signal === "FALLING_KNIFE")),
      structural: take(sectors.filter((r) => r.signal === "STRUCTURAL_WEAKNESS")),
    },
  };
}

export async function getIndexDetail(id: number) {
  const db = getDb();
  const [idx] = await db.select().from(indices).where(eq(indices.id, id)).limit(1);
  return idx ?? null;
}

export function applyScannerFilters(
  rows: ScannerRow[],
  q: {
    drawdown?: number;
    y1?: number;
    y2?: number;
    y5?: number;
    recovery?: "high" | "medium" | "low";
    trend?: "bullish" | "neutral" | "bearish";
    classification?: string;
    signal?: string;
    sort?: string;
  },
) {
  let out = rows;
  if (q.drawdown != null) out = out.filter((r) => r.distanceFromAth >= q.drawdown!);
  if (q.y1 != null) out = out.filter((r) => r.return1y != null && r.return1y <= q.y1!);
  if (q.y2 != null) out = out.filter((r) => r.return2y != null && r.return2y <= q.y2!);
  if (q.y5 != null) out = out.filter((r) => r.return5y != null && r.return5y <= q.y5!);
  if (q.recovery === "high") out = out.filter((r) => r.recoveryScore >= 60);
  if (q.recovery === "medium") out = out.filter((r) => r.recoveryScore >= 35 && r.recoveryScore < 60);
  if (q.recovery === "low") out = out.filter((r) => r.recoveryScore < 35);
  if (q.trend === "bullish") out = out.filter((r) => r.technical.overall === "BULLISH");
  if (q.trend === "bearish") out = out.filter((r) => r.technical.overall === "BEARISH");
  if (q.trend === "neutral") out = out.filter((r) => r.technical.overall === "NEUTRAL");
  if (q.classification) out = out.filter((r) => r.classification === q.classification);
  if (q.signal) out = out.filter((r) => r.signal === q.signal);

  switch (q.sort) {
    case "drawdown":
      out = [...out].sort((a, b) => b.distanceFromAth - a.distanceFromAth);
      break;
    case "y1":
      out = [...out].sort((a, b) => (a.return1y ?? 999) - (b.return1y ?? 999));
      break;
    case "y2":
      out = [...out].sort((a, b) => (a.return2y ?? 999) - (b.return2y ?? 999));
      break;
    case "y5":
      out = [...out].sort((a, b) => (a.return5y ?? 999) - (b.return5y ?? 999));
      break;
    case "recovery":
      out = [...out].sort((a, b) => b.recoveryScore - a.recoveryScore);
      break;
    case "opportunity":
      out = [...out].sort((a, b) => b.opportunityScore - a.opportunityScore);
      break;
    case "rs":
      out = [...out].sort((a, b) => (a.rs1yNifty50 ?? 0) - (b.rs1yNifty50 ?? 0));
      break;
    case "recent_recovery":
      out = [...out].sort((a, b) => (b.return3m ?? -999) - (a.return3m ?? -999));
      break;
    default:
      break;
  }
  return out.map((r, i) => ({ ...r, rank: i + 1 }));
}
