import { loadScannerRows, latestMetricDate } from "@/services/queries";
import { loadFundRows } from "@/services/mf-queries";
import { loadStockRows } from "@/services/stock-metrics";
import { latestMarketContext } from "@/services/market-context";
import { pickMajorFunds } from "@/services/major-funds";
import { formatPct } from "@/lib/utils";
import { explainIndexRow, explainMarketReading, matchRelatedSectors, whySummary } from "@/services/explain";
import { impliedSectorFromCategory } from "@/mf/sector-map";

export type Trend = "UP" | "MIXED" | "DOWN" | "UNKNOWN";

export type SimplePick = {
  type: "SECTOR" | "FUND" | "STOCK";
  id: number;
  name: string;
  href: string;
  trend: Trend;
  why: string;
  riskReward: string;
  fundamentals: string;
  technicals: string;
  caution: string;
  sleeve?: string;
  return1y: number | null;
  drawdown: number | null;
  score: number | null;
};

const BLOCKED = new Set([
  "FALLING_KNIFE",
  "STRUCTURAL_WEAKNESS",
  "VALUE_TRAP",
  "INSUFFICIENT_HISTORY",
  "POSSIBLE_CAPITULATION",
]);

export function trendFromMoves(input: { m1: number | null; y1: number | null; vs200: number | null }): Trend {
  const marks = [
    input.m1 == null ? null : input.m1 > 0,
    input.y1 == null ? null : input.y1 > 0,
    input.vs200 == null ? null : input.vs200 > 0,
  ].filter((v): v is boolean => v != null);
  if (!marks.length) return "UNKNOWN";
  const up = marks.filter(Boolean).length;
  if (up === marks.length && marks.length >= 2) return "UP";
  if (up === 0) return "DOWN";
  return "MIXED";
}

function blocked(label: string | null | undefined) {
  return BLOCKED.has((label ?? "").toUpperCase());
}

function take<T>(rows: T[], n = 8) {
  return rows.slice(0, n);
}

/** Rising now, not a crash, not only a one-week bounce. */
export function isConstructive(input: {
  trend: Trend;
  m1: number | null;
  y1: number | null;
  vs200: number | null;
  drawdown: number | null;
}) {
  if (input.trend === "DOWN" || input.trend === "UNKNOWN") return false;
  if (input.m1 == null || input.m1 <= 0) return false;
  const longerUp = (input.y1 != null && input.y1 > 0) || (input.vs200 != null && input.vs200 > 0);
  if (!longerUp) return false;
  if (input.drawdown != null && input.drawdown >= 40) return false;
  return true;
}

/**
 * One-screen research shortlist.
 * Rising + usable risk/reward + quality when present.
 * Not a forecast of future returns. Missing fundamentals stay N/A.
 */
export async function buildSimplePicks() {
  const asOf = await latestMetricDate("PR");
  const [sectors, funds, stocks, regime] = await Promise.all([
    loadScannerRows({ returnType: "PR" }),
    loadFundRows({ plan: "DIRECT", option: "GROWTH" }).catch(() => []),
    loadStockRows().catch(() => []),
    latestMarketContext().catch(() => null),
  ]);

  const sectorPicks: SimplePick[] = sectors
    .filter((s) => {
      if (s.isBenchmark || blocked(s.signal) || blocked(s.classification)) return false;
      if (/arbitrage|1d rate|overnight|liquid/i.test(s.name)) return false;
      const trend = trendFromMoves({ m1: s.return1m, y1: s.return1y, vs200: s.priceVs200 });
      return isConstructive({ trend, m1: s.return1m, y1: s.return1y, vs200: s.priceVs200, drawdown: s.distanceFromAth });
    })
    .map((s) => {
      const trend = trendFromMoves({ m1: s.return1m, y1: s.return1y, vs200: s.priceVs200 });
      return {
        type: "SECTOR" as const,
        id: s.indexId,
        name: s.name,
        href: `/indices/${s.indexId}`,
        trend,
        why: whySummary(s.explanation ?? explainIndexRow(s)),
        riskReward:
          s.distanceFromAth != null
            ? `${s.distanceFromAth.toFixed(0)}% below ATH · 1Y ${formatPct(s.return1y)} · recovery ${s.recoveryScore.toFixed(0)}`
            : "Drawdown N/A",
        fundamentals: "Index — no PE/ROE. Quality is the trend + recovery, not a balance sheet.",
        technicals: `vs 200DMA ${s.priceVs200 == null ? "N/A" : `${s.priceVs200.toFixed(1)}%`} · 1M ${formatPct(s.return1m)} · RS vs Nifty 50 ${formatPct(s.rs1yNifty50)}`,
        caution: "Historical research label, not a return forecast.",
        return1y: s.return1y,
        drawdown: s.distanceFromAth,
        score: s.opportunityScore,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.return1y ?? -999) - (a.return1y ?? -999));

  const fundPicks: SimplePick[] = funds
    .filter(
      (f) =>
        !blocked(f.classification) &&
        !blocked(f.signal) &&
        (f.overallScore ?? 0) >= 55 &&
        (f.return1y ?? 0) > 0 &&
        (f.sharpe == null || f.sharpe > 0.3) &&
        (f.maxDrawdown == null || f.maxDrawdown > -40),
    )
    .map((f) => {
      const trend = trendFromMoves({ m1: f.return1y, y1: f.cagr3y, vs200: null });
      const rr =
        f.sharpe != null || f.maxDrawdown != null
          ? `Sharpe ${f.sharpe != null ? f.sharpe.toFixed(2) : "N/A"} · max DD ${formatPct(f.maxDrawdown)} · 5Y ${formatPct(f.cagr5y)}`
          : "Risk ratios N/A until more NAV history is stored.";
      return {
        type: "FUND" as const,
        id: f.id,
        name: f.schemeName,
        href: `/mutual-funds/${f.id}`,
        trend,
        why: whySummary(
          explainMarketReading({
            kind: "FUND",
            name: f.schemeName,
            signal: f.signal,
            classification: f.classification,
            category: f.category,
            return1y: f.return1y,
            return3y: f.cagr3y,
            return5y: f.cagr5y,
            drawdown: f.currentDrawdown,
            maxDrawdown: f.maxDrawdown,
            sharpe: f.sharpe,
            consistency: f.consistency,
            overallScore: f.overallScore,
            related: matchRelatedSectors(sectors, impliedSectorFromCategory(f.category, f.assetClass)),
          }),
        ),
        riskReward: rr,
        fundamentals:
          f.consistency != null || f.expenseRatio != null
            ? `Consistency ${f.consistency != null ? f.consistency.toFixed(0) : "N/A"} · TER ${f.expenseRatio != null ? `${f.expenseRatio.toFixed(2)}%` : "N/A"}`
            : "Holdings / TER N/A without a licensed portfolio feed. Score uses official NAVs.",
        technicals: `1Y ${formatPct(f.return1y)} · 3Y ${formatPct(f.cagr3y)} · now ${formatPct(f.currentDrawdown)} below own peak`,
        caution: "Past SIP/CAGR is not a future return.",
        return1y: f.return1y,
        drawdown: f.currentDrawdown,
        score: f.overallScore,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const majorFunds: SimplePick[] = pickMajorFunds(funds).map(({ sleeve, fund: f }) => {
    const trend = trendFromMoves({ m1: f.return1y, y1: f.cagr3y, vs200: null });
    return {
      type: "FUND" as const,
      id: f.id,
      name: f.schemeName,
      href: `/mutual-funds/${f.id}`,
      trend,
      sleeve,
      why: whySummary(
        explainMarketReading({
          kind: "FUND",
          name: f.schemeName,
          signal: f.signal,
          classification: f.classification,
          category: f.category,
          return1y: f.return1y,
          return3y: f.cagr3y,
          return5y: f.cagr5y,
          drawdown: f.currentDrawdown,
          maxDrawdown: f.maxDrawdown,
          sharpe: f.sharpe,
          consistency: f.consistency,
          overallScore: f.overallScore,
          related: matchRelatedSectors(sectors, impliedSectorFromCategory(f.category, f.assetClass)),
        }),
      ),
      riskReward: `Sharpe ${f.sharpe != null ? f.sharpe.toFixed(2) : "N/A"} · max DD ${formatPct(f.maxDrawdown)} · 5Y ${formatPct(f.cagr5y)}`,
      fundamentals:
        f.consistency != null || f.expenseRatio != null
          ? `Consistency ${f.consistency != null ? f.consistency.toFixed(0) : "N/A"} · TER ${f.expenseRatio != null ? `${f.expenseRatio.toFixed(2)}%` : "N/A"}`
          : "TER / holdings N/A without a licensed feed.",
      technicals: `1Y ${formatPct(f.return1y)} · 3Y ${formatPct(f.cagr3y)} · now ${formatPct(f.currentDrawdown)} below own peak`,
      caution: blocked(f.classification)
        ? `${(f.classification ?? "").replaceAll("_", " ")} — shown because it is a major sleeve, not because it passed the rising screen.`
        : "Flagship sleeve from official AMFI NAVs. History is not a forecast.",
      return1y: f.return1y,
      drawdown: f.currentDrawdown,
      score: f.overallScore,
    };
  });

  const listed = stocks.filter((s) => Array.isArray(s.indexMemberships) && s.indexMemberships.length > 0);
  const stockUniverse = listed.length >= 20 ? listed : stocks;
  const scoredStocks = stockUniverse.filter((s) => {
    if (blocked(s.classification) || s.return1y == null || s.distanceFromAth == null) return false;
    const trend = trendFromMoves({ m1: s.return1m, y1: s.return1y, vs200: s.priceVs200 });
    return isConstructive({
      trend,
      m1: s.return1m,
      y1: s.return1y,
      vs200: s.priceVs200,
      drawdown: s.distanceFromAth,
    });
  });
  const stockPicks: SimplePick[] = scoredStocks
    .map((s) => {
      const trend = trendFromMoves({ m1: s.return1m, y1: s.return1y, vs200: s.priceVs200 });
      const hasFund = s.qualityScore != null || s.valuationScore != null || s.earningsScore != null;
      return {
        type: "STOCK" as const,
        id: s.id,
        name: s.companyName ? `${s.symbol} · ${s.companyName}` : s.symbol,
        href: `/stocks/${s.id}`,
        trend,
        why: whySummary(
          explainMarketReading({
            kind: "STOCK",
            name: s.companyName ? `${s.symbol} · ${s.companyName}` : s.symbol,
            signal: s.classification,
            classification: s.classification,
            return1m: s.return1m,
            return3m: s.return3m,
            return1y: s.return1y,
            return3y: s.return3y,
            return5y: s.return5y,
            priceVs50: s.priceVs50,
            priceVs200: s.priceVs200,
            drawdown: s.distanceFromAth,
            sectorName: s.sector ?? s.industry,
            related: matchRelatedSectors(
              sectors,
              s.sector ? [{ nseName: s.sector, weight: 100, source: "sector" }] : [],
            ),
          }),
        ),
        riskReward: `${s.distanceFromAth!.toFixed(0)}% below stored ATH · 1Y ${formatPct(s.return1y)} · RS ${s.rsScore != null ? s.rsScore.toFixed(0) : "N/A"}`,
        fundamentals: hasFund
          ? `Quality ${s.qualityScore ?? "N/A"} · Value ${s.valuationScore ?? "N/A"} · Earnings ${s.earningsScore ?? "N/A"}`
          : "PE / ROE / earnings N/A — no licensed fundamental feed. Not scored as 0.",
        technicals: `vs 200DMA ${s.priceVs200 == null ? "N/A" : `${s.priceVs200.toFixed(1)}%`} · 1M ${formatPct(s.return1m)} · RSI ${s.rsi != null ? s.rsi.toFixed(0) : "N/A"}`,
        caution: "ATH uses adjusted close when official split/bonus factors are stored. Not a buy call.",
        return1y: s.return1y,
        drawdown: s.distanceFromAth,
        score: s.opportunityScore,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.return1y ?? -999) - (a.return1y ?? -999));

  const gaps: string[] = [];
  if (scoredStocks.length < 20) {
    gaps.push(
      "Stock 1Y / ATH / DMA need more official bhavcopy days. Until then this column stays thin — we will not invent those numbers.",
    );
  }
  if (!funds.length) gaps.push("No Direct Growth fund scores yet. Run npm run ingest:all.");
  if (!sectors.length) gaps.push("No sector scores yet. Run npm run ingest:all.");

  return {
    asOf,
    regime: regime && "regime" in regime ? String(regime.regime) : null,
    regimeScore: regime && "score" in regime && regime.score != null ? Number(regime.score) : null,
    disclaimer:
      "Shortlist of names that are rising, not collapsing, and have a readable risk/reward in the local official data. This is not a prediction of good future returns and not a buy list.",
    gaps,
    sectors: take(sectorPicks),
    funds: take(fundPicks),
    majorFunds,
    stocks: take(stockPicks),
    coverage: {
      sectorsScanned: sectors.filter((s) => !s.isBenchmark).length,
      fundsScanned: funds.length,
      stocksWithHistory: stocks.filter((s) => s.return1y != null && s.distanceFromAth != null).length,
      stocksListed: stocks.length,
    },
  };
}
