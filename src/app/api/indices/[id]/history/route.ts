import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { indexPrices } from "@/db/schema";
import { runningDrawdownSeries } from "@/calculations/drawdown";
import { sma } from "@/calculations/moving-averages";
import { ok } from "../../../_util";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "MAX";
  const returnType = url.searchParams.get("returnType") === "TR" ? "TR" : "PR";
  const db = getDb();
  const rows = await db
    .select()
    .from(indexPrices)
    .where(and(eq(indexPrices.indexId, Number(id)), eq(indexPrices.returnType, returnType)))
    .orderBy(asc(indexPrices.date));

  const bars = rows.map((r) => ({
    date: r.date,
    close: Number(r.close),
    high: r.high != null ? Number(r.high) : Number(r.close),
    open: r.open != null ? Number(r.open) : Number(r.close),
    low: r.low != null ? Number(r.low) : Number(r.close),
  }));
  const cut = cutRange(bars, range);
  const closes = cut.map((b) => b.close);
  const series = cut.map((b, i) => {
    const slice = closes.slice(0, i + 1);
    return {
      date: b.date,
      close: b.close,
      ma50: sma(slice, 50),
      ma200: sma(slice, 200),
    };
  });
  const ath = cut.reduce((m, b) => Math.max(m, b.close), 0);
  const drawdowns = runningDrawdownSeries(cut);
  return ok({ range, returnType, ath, series, drawdowns });
}

function cutRange<T extends { date: string }>(bars: T[], range: string): T[] {
  if (range === "MAX" || !bars.length) return bars;
  const last = bars[bars.length - 1].date;
  const end = new Date(`${last}T00:00:00Z`);
  const years = range === "1Y" ? 1 : range === "2Y" ? 2 : range === "5Y" ? 5 : range === "10Y" ? 10 : 99;
  end.setUTCFullYear(end.getUTCFullYear() - years);
  const from = end.toISOString().slice(0, 10);
  return bars.filter((b) => b.date >= from);
}
