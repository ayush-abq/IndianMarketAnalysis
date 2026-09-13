import { and, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { indexPrices, indices, stockPrices, stocks } from "@/db/schema";
import { analyzeStructure, type StructureLabel } from "@/calculations/structure";
import type { PriceBar } from "@/calculations/trading-days";
import { addCalendarDays } from "@/calculations/trading-days";
import { isSectorResearchIndex } from "@/lib/universe-filter";
import { latestMetricDate } from "@/services/queries";

export type StructureRow = {
  type: "STOCK" | "INDEX";
  id: number;
  name: string;
  href: string;
  close: number;
  label: StructureLabel;
  distanceTo20HighPct: number | null;
  daysSinceBreakout: number | null;
  higherHighsHigherLows: boolean | null;
  volumeConfirms: boolean | null;
  trendState: string | null;
  why: string[];
  risks: string[];
};

const MEMBER_KEYS = ["NIFTY50", "NIFTY100", "NIFTY200", "NIFTY500", "NIFTY_MIDCAP_150", "NIFTY_SMALLCAP_250"];

function num(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBars(
  rows: { date: string; open: string | null; high: string | null; low: string | null; close: string; volume: string | null }[],
): PriceBar[] {
  return rows
    .map((r) => ({
      date: r.date,
      open: num(r.open),
      high: num(r.high),
      low: num(r.low),
      close: Number(r.close),
      volume: num(r.volume),
    }))
    .filter((b) => Number.isFinite(b.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function ranked(rows: StructureRow[], labels: StructureLabel[]) {
  return rows
    .filter((r) => labels.includes(r.label))
    .sort((a, b) => {
      const order = labels.indexOf(a.label) - labels.indexOf(b.label);
      if (order !== 0) return order;
      return (a.distanceTo20HighPct ?? 99) - (b.distanceTo20HighPct ?? 99);
    });
}

export async function scanMarketStructure() {
  const asOf = await latestMetricDate("PR");
  const db = getDb();
  const cutoff = addCalendarDays(asOf ?? "2026-09-11", -200);

  const allStocks = await db.select().from(stocks).where(eq(stocks.active, true));
  const universe = allStocks.filter((s) => {
    const m = (s.indexMemberships as string[] | null) ?? [];
    return m.some((x) => MEMBER_KEYS.includes(x));
  });
  const stockIds = (universe.length >= 30 ? universe : allStocks).map((s) => s.id);
  const stockById = new Map((universe.length >= 30 ? universe : allStocks).map((s) => [s.id, s]));

  const px =
    stockIds.length === 0
      ? []
      : await db
          .select()
          .from(stockPrices)
          .where(and(inArray(stockPrices.stockId, stockIds), gte(stockPrices.date, cutoff)));

  const byStock = new Map<number, typeof px>();
  for (const row of px) {
    const list = byStock.get(row.stockId) ?? [];
    list.push(row);
    byStock.set(row.stockId, list);
  }

  const stockRows: StructureRow[] = [];
  for (const [id, rows] of byStock) {
    const stock = stockById.get(id);
    if (!stock) continue;
    const result = analyzeStructure(toBars(rows));
    if (!result) continue;
    stockRows.push({
      type: "STOCK",
      id,
      name: stock.companyName ? `${stock.symbol} · ${stock.companyName}` : stock.symbol,
      href: `/stocks/${id}`,
      close: result.close,
      label: result.label,
      distanceTo20HighPct: result.distanceTo20HighPct,
      daysSinceBreakout: result.daysSinceBreakout,
      higherHighsHigherLows: result.higherHighsHigherLows,
      volumeConfirms: result.volumeConfirms,
      trendState: result.trendState,
      why: result.why,
      risks: result.risks,
    });
  }

  const idxList = await db.select().from(indices).where(eq(indices.active, true));
  const watch = idxList.filter(
    (i) => i.isBenchmark || isSectorResearchIndex({ name: i.name, category: i.category, isBenchmark: i.isBenchmark, nseName: i.nseName }),
  );
  const idxIds = watch.map((i) => i.id);
  const idxPx =
    idxIds.length === 0
      ? []
      : await db
          .select()
          .from(indexPrices)
          .where(and(inArray(indexPrices.indexId, idxIds), eq(indexPrices.returnType, "PR"), gte(indexPrices.date, cutoff)));
  const byIdx = new Map<number, typeof idxPx>();
  for (const row of idxPx) {
    const list = byIdx.get(row.indexId) ?? [];
    list.push(row);
    byIdx.set(row.indexId, list);
  }
  const indexRows: StructureRow[] = [];
  for (const idx of watch) {
    const rows = byIdx.get(idx.id);
    if (!rows) continue;
    const result = analyzeStructure(toBars(rows));
    if (!result) continue;
    indexRows.push({
      type: "INDEX",
      id: idx.id,
      name: idx.name,
      href: `/indices/${idx.id}`,
      close: result.close,
      label: result.label,
      distanceTo20HighPct: result.distanceTo20HighPct,
      daysSinceBreakout: result.daysSinceBreakout,
      higherHighsHigherLows: result.higherHighsHigherLows,
      volumeConfirms: result.volumeConfirms,
      trendState: result.trendState,
      why: result.why,
      risks: result.risks,
    });
  }

  return {
    asOf,
    disclaimer:
      "Official EOD closes only (bhavcopy / index files). This is not Chartink and not a live intraday scanner. A coil is not a prediction that price will break out. Failed breaks are shown so a pop is not treated as a confirmed trend.",
    scanned: { stocks: stockRows.length, indices: indexRows.length },
    stocks: {
      fresh: ranked(stockRows, ["FRESH_BREAKOUT"]).slice(0, 20),
      recent: ranked(stockRows, ["RECENT_BREAKOUT"]).slice(0, 20),
      coiled: ranked(stockRows, ["COILED"]).slice(0, 20),
      failed: ranked(stockRows, ["FAILED_BREAKOUT"]).slice(0, 12),
    },
    indices: {
      fresh: ranked(indexRows, ["FRESH_BREAKOUT", "RECENT_BREAKOUT"]).slice(0, 12),
      coiled: ranked(indexRows, ["COILED"]).slice(0, 12),
      failed: ranked(indexRows, ["FAILED_BREAKOUT"]).slice(0, 8),
    },
  };
}
