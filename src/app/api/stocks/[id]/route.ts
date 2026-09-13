import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { stockFundamentals, stockScores, stocks } from "@/db/schema";
import { loadStockCorporateActions } from "@/services/corporate-actions";
import { loadStockBars } from "@/services/stock-metrics";
import { calculateReturns } from "@/calculations/returns";
import { calculateDrawdown } from "@/calculations/drawdown";
import { computeMaBundle } from "@/calculations/moving-averages";
import { rsi, atr, bollinger } from "@/calculations/indicators";
import { DRAWDOWN_THRESHOLDS } from "@/config/defaults";
import { historicalAnalogues } from "@/services/signal-tracker";
import { explainMarketReading } from "@/services/explain";
import { withLicensedNews } from "@/providers/market-news";
import { loadScannerRows } from "@/services/queries";
import { fail, ok } from "../../_util";
import { technicalOverview } from "@/scoring/technical-stance";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const stockId = Number(id);
  if (!Number.isFinite(stockId)) return fail("Invalid stock id");
  const db = getDb();
  const [stock] = await db.select().from(stocks).where(eq(stocks.id, stockId)).limit(1);
  if (!stock) return fail("Stock not found", 404);
  const bars = await loadStockBars(stockId);
  const returns = bars.length >= 2 ? calculateReturns(bars) : null;
  const dd = bars.length ? calculateDrawdown(bars, DRAWDOWN_THRESHOLDS, "closing") : null;
  const mas = bars.length ? computeMaBundle(bars) : null;
  const closes = bars.map((b) => b.close);
  const [score] = await db.select().from(stockScores).where(eq(stockScores.stockId, stockId)).limit(1);
  const [fund] = await db.select().from(stockFundamentals).where(eq(stockFundamentals.stockId, stockId)).limit(1);
  const actions = await loadStockCorporateActions(stockId);
  const caEvents = actions.map((a) => ({
    headline: `${a.actionType}${a.ratio ? ` ${a.ratio}` : ""}`,
    source: "NSE official PR book-closure",
    date: a.date,
  }));
  const analogues =
    dd != null
      ? await historicalAnalogues({ drawdown: dd.distanceFromAthPercent })
      : null;
  const sectors = stock.sector ? await loadScannerRows({ returnType: "PR", includeBenchmarks: true }).catch(() => []) : [];
  const linked = stock.sector
    ? sectors.filter((s) => s.name.toLowerCase().includes(String(stock.sector).toLowerCase().replace(/^nifty\s+/, "")))
    : [];
  const explanation = await withLicensedNews(
    explainMarketReading({
      kind: "STOCK",
      name: stock.companyName ? `${stock.symbol} · ${stock.companyName}` : stock.symbol,
      signal: score?.signal ?? score?.classification,
      classification: score?.classification,
      return1m: returns?.m1 ?? (score?.return1m != null ? Number(score.return1m) : null),
      return3m: returns?.m3 ?? (score?.return3m != null ? Number(score.return3m) : null),
      return1y: returns?.y1 ?? (score?.return1y != null ? Number(score.return1y) : null),
      return3y: returns?.y3 ?? (score?.return3y != null ? Number(score.return3y) : null),
      return5y: returns?.y5 ?? (score?.return5y != null ? Number(score.return5y) : null),
      priceVs50: mas?.priceVs50 ?? (score?.priceVs50 != null ? Number(score.priceVs50) : null),
      priceVs200: mas?.priceVs200 ?? (score?.priceVs200 != null ? Number(score.priceVs200) : null),
      rs1y: score?.rsScore != null ? Number(score.rsScore) : null,
      drawdown: dd?.distanceFromAthPercent ?? (score?.distanceFromAth != null ? Number(score.distanceFromAth) : null),
      sectorName: stock.sector ?? stock.industry,
      related: linked.slice(0, 2).map((s) => ({
        name: s.name,
        signal: s.signal,
        return1y: s.return1y,
        drawdown: s.distanceFromAth,
        source: "sector",
      })),
    }),
    { name: stock.companyName ?? stock.symbol, symbol: stock.symbol },
  );
  if (!explanation.news.length && caEvents.length) {
    explanation.news = caEvents;
    explanation.newsNote = "Official NSE book-closure file (PR zip). Split/bonus/dividend dates only — not a news headline.";
  }
  const hasFundamentals = fund && (fund.pe != null || fund.pb != null || fund.roe != null || fund.roce != null);
  const rsi14 = closes.length ? rsi(closes) : null;
  return ok({
    stock,
    returns,
    drawdown: dd,
    mas,
    rsi: rsi14,
    atr: atr(bars),
    bollinger: bollinger(closes),
    technical: technicalOverview({
      rsi: rsi14,
      priceVs50: mas?.priceVs50 ?? null,
      priceVs200: mas?.priceVs200 ?? null,
      return1m: returns?.m1 ?? null,
      return3m: returns?.m3 ?? null,
      trendState: mas?.trendState ?? null,
    }),
    score,
    explanation,
    fundamentals: hasFundamentals ? fund : null,
    corporateActions: actions.map((a) => ({
      date: a.date,
      actionType: a.actionType,
      ratio: a.ratio,
      factor: a.factor != null ? Number(a.factor) : null,
    })),
    analogues: analogues && analogues.comparable > 0 ? analogues : null,
    methodology: {
      ath: "Closing-price ATH as-of the latest bar. Adjusted ATH uses adjusted_close when corporate-action factors exist.",
      returns: "Computed on adjusted_close when present, otherwise close.",
    },
    disclaimer: "Research snapshot only. Not a recommendation to buy or sell.",
  });
}
