/**
 * Horizon board: official lookback returns by window.
 * Not a forecast. News only if a licensed feed is configured.
 */
import { loadScannerRows, latestMetricDate } from "@/services/queries";
import { loadFundRows } from "@/services/mf-queries";
import { loadStockRows } from "@/services/stock-metrics";
import { latestMarketContext } from "@/services/market-context";
import { fetchLicensedNews } from "@/providers/market-news";
import { technicalOverview, type Stance, type TechnicalOverview } from "@/scoring/technical-stance";
import { cagrFromReturn } from "@/services/stock-metrics";

export const HORIZON_KEYS = ["1M", "3M", "6M", "1Y", "3Y", "5Y", "10Y"] as const;
export type HorizonKey = (typeof HORIZON_KEYS)[number];

export type HorizonMeta = {
  key: HorizonKey;
  label: string;
  term: string;
  kind: "total" | "cagr";
  note: string;
};

export const HORIZON_META: HorizonMeta[] = [
  { key: "1M", label: "1 month", term: "horizon1m", kind: "total", note: "About the last 21 official sessions." },
  { key: "3M", label: "3 months", term: "horizon3m", kind: "total", note: "About the last 63 official sessions." },
  { key: "6M", label: "6 months", term: "horizon6m", kind: "total", note: "About the last 126 official sessions. Stock 6M is N/A until stored." },
  { key: "1Y", label: "1 year", term: "horizon1y", kind: "total", note: "About the last 252 official sessions." },
  { key: "3Y", label: "3 years", term: "horizon3y", kind: "cagr", note: "Sectors/stocks: total %. Funds: yearly rate (CAGR)." },
  { key: "5Y", label: "5 years", term: "horizon5y", kind: "cagr", note: "Sectors/stocks: total %. Funds: yearly rate (CAGR)." },
  { key: "10Y", label: "10 years", term: "horizon10y", kind: "cagr", note: "Official fund CAGR only. Index and stock 10Y are not stored." },
];

export type HorizonRow = {
  type: "SECTOR" | "FUND" | "STOCK";
  id: number;
  name: string;
  href: string;
  horizonReturn: number | null;
  stance: Stance | null;
  technical: TechnicalOverview | null;
  classification: string | null;
  drawdown: number | null;
  vs200: number | null;
  why: string;
};

const BLOCKED = new Set(["FALLING_KNIFE", "STRUCTURAL_WEAKNESS", "VALUE_TRAP", "INSUFFICIENT_HISTORY", "POSSIBLE_CAPITULATION"]);

export function isBlockedLabel(label: string | null | undefined) {
  return BLOCKED.has((label ?? "").toUpperCase());
}

export function pickHorizonValue(input: Record<HorizonKey, number | null | undefined>, key: HorizonKey): number | null {
  const v = input[key];
  return v != null && Number.isFinite(v) ? v : null;
}

export function isCashLikeFund(name: string) {
  return /existing number|overnight|liquid fund|money market|floater|arbitrage/i.test(name);
}

/** Drop listing/NAV artifacts. Missing stays missing — we do not clip to a fake number. */
export function isPlausibleLookback(type: HorizonRow["type"], key: HorizonKey, value: number | null): boolean {
  if (value == null || !Number.isFinite(value) || value <= 0) return false;
  const cap =
    type === "FUND"
      ? { "1M": 25, "3M": 40, "6M": 60, "1Y": 80, "3Y": 45, "5Y": 40, "10Y": 30 }[key]
      : type === "STOCK"
        ? { "1M": 50, "3M": 100, "6M": 140, "1Y": 180, "3Y": 400, "5Y": 800, "10Y": 40 }[key]
        : { "1M": 25, "3M": 50, "6M": 80, "1Y": 80, "3Y": 300, "5Y": 500, "10Y": 40 }[key];
  return value <= cap;
}

export function rankHorizonRows(rows: HorizonRow[], key: HorizonKey, limit = 12): HorizonRow[] {
  return rows
    .filter(
      (r) =>
        !isBlockedLabel(r.classification) &&
        !(r.type === "FUND" && isCashLikeFund(r.name)) &&
        isPlausibleLookback(r.type, key, r.horizonReturn),
    )
    .sort((a, b) => (b.horizonReturn ?? -Infinity) - (a.horizonReturn ?? -Infinity) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function scenarioFromRegime(regime: string | null, score: number | null): {
  title: string;
  summary: string;
  preferred: string;
  caution: string;
} {
  const r = (regime ?? "NEUTRAL").toUpperCase();
  if (r === "BULL") {
    return {
      title: "Bull tape",
      summary: "Official Nifty closes are above the long average with a shallow fall from peak.",
      preferred: "Shorter windows (1M–1Y) have more names with positive stored returns. Still history, not a forecast.",
      caution: "A bull tape can reverse. Falling-knife names stay off this board.",
    };
  }
  if (r === "RECOVERY") {
    return {
      title: "Recovery tape",
      summary: "The official index fell, then recent sessions started to heal.",
      preferred: "1M–6M lists can look strong after a bounce. Check 200-DMA and below-peak before treating it as durable.",
      caution: "Early repair is not a 3Y or 5Y promise.",
    };
  }
  if (r === "BEAR") {
    return {
      title: "Bear tape",
      summary: "Official Nifty is weak versus the 200-DMA with a large stored fall from peak.",
      preferred: "Long-window fund CAGRs can still look fine. Short-window winners may be dead-cat bounces.",
      caution: "Do not read a 1-month bounce as a regime change.",
    };
  }
  if (r === "CORRECTION") {
    return {
      title: "Correction tape",
      summary: "The index is 10–20% below its stored peak and below the 200-DMA.",
      preferred: "Quality funds with long official CAGRs are more useful than one-month stock spikes.",
      caution: "Corrections can deepen. This is not a buy-the-dip call.",
    };
  }
  if (r === "HIGH_VOLATILITY") {
    return {
      title: "High-volatility tape",
      summary: "India VIX (when stored) or the official breadth says swings are large.",
      preferred: "Shorter lists are noisier. Prefer names with a readable 1Y–5Y official history.",
      caution: "Volatility is not a return forecast.",
    };
  }
  if (r === "SIDEWAYS") {
    return {
      title: "Sideways tape",
      summary: "Short and long official averages disagree — Neutral on Groww’s overview.",
      preferred: "6M–1Y stored returns are more informative than a single hot month.",
      caution: "Range-bound tape can break either way.",
    };
  }
  return {
    title: "Neutral tape",
    summary: score != null ? `Regime score ${score.toFixed(0)} from official breadth and Nifty closes.` : "Not enough official tape to name a regime.",
    preferred: "Use each horizon as a lookback rank, not a target.",
    caution: "No licensed global-macro feed is attached. We do not invent geopolitics.",
  };
}

export async function buildHorizonBoard() {
  const asOf = await latestMetricDate("PR");
  const [sectors, funds, stocks, regimeRow, news] = await Promise.all([
    loadScannerRows({ returnType: "PR" }),
    loadFundRows({ plan: "DIRECT", option: "GROWTH" }).catch(() => []),
    loadStockRows().catch(() => []),
    latestMarketContext().catch(() => null),
    fetchLicensedNews({ name: "Nifty 50", symbol: "NIFTY 50" }),
  ]);

  const regime = regimeRow && "regime" in regimeRow ? String(regimeRow.regime) : null;
  const regimeScore = regimeRow && "score" in regimeRow && regimeRow.score != null ? Number(regimeRow.score) : null;
  const scenario = scenarioFromRegime(regime, regimeScore);

  const byHorizon = Object.fromEntries(
    HORIZON_KEYS.map((key) => {
      const sectorRows = rankHorizonRows(
        sectors
          .filter((s) => !s.isBenchmark)
          .map((s) => ({
            type: "SECTOR" as const,
            id: s.indexId,
            name: s.name,
            href: `/indices/${s.indexId}`,
            horizonReturn: pickHorizonValue(
              {
                "1M": s.return1m,
                "3M": s.return3m,
                "6M": s.return6m,
                "1Y": s.return1y,
                "3Y": s.return3y,
                "5Y": s.return5y,
                "10Y": null,
              },
              key,
            ),
            stance: s.technical?.overall ?? null,
            technical: s.technical ?? null,
            classification: s.classification,
            drawdown: s.distanceFromAth,
            vs200: s.priceVs200,
            why: s.whyShort,
          })),
        key,
      );
      const fundRows = rankHorizonRows(
        funds.map((f) => {
          const tape = technicalOverview({ return1m: f.return1m, return3m: f.return3m });
          return {
            type: "FUND" as const,
            id: f.id,
            name: f.schemeName,
            href: `/mutual-funds/${f.id}`,
            horizonReturn: pickHorizonValue(
              {
                "1M": f.return1m,
                "3M": f.return3m,
                "6M": f.return6m,
                "1Y": f.return1y,
                "3Y": f.cagr3y,
                "5Y": f.cagr5y,
                "10Y": f.cagr10y ?? cagrFromReturn(f.return10y, 10),
              },
              key,
            ),
            stance: tape.overall,
            technical: tape,
            classification: f.classification,
            drawdown: f.currentDrawdown,
            vs200: null,
            why: f.whyShort,
          };
        }),
        key,
      );
      const listed = stocks.filter((s) => Array.isArray(s.indexMemberships) && s.indexMemberships.length > 0);
      const stockUniverse = listed.length >= 20 ? listed : stocks;
      const stockRows = rankHorizonRows(
        stockUniverse.map((s) => ({
            type: "STOCK" as const,
            id: s.id,
            name: s.companyName ? `${s.symbol} · ${s.companyName}` : s.symbol,
            href: `/stocks/${s.id}`,
            horizonReturn: pickHorizonValue(
              {
                "1M": s.return1m,
                "3M": s.return3m,
                "6M": null,
                "1Y": s.return1y,
                "3Y": s.return3y,
                "5Y": s.return5y,
                "10Y": null,
              },
              key,
            ),
            stance: s.technical?.overall ?? null,
            technical: s.technical ?? null,
            classification: s.classification,
            drawdown: s.distanceFromAth,
            vs200: s.priceVs200,
            why: s.whyShort,
          })),
        key,
      );
      return [key, { sectors: sectorRows, funds: fundRows, stocks: stockRows }];
    }),
  ) as Record<HorizonKey, { sectors: HorizonRow[]; funds: HorizonRow[]; stocks: HorizonRow[] }>;

  return {
    asOf,
    regime,
    regimeScore,
    scenario,
    news,
    horizons: HORIZON_META,
    byHorizon,
    disclaimer:
      "Each list ranks official stored returns for that lookback. A high past percent is not a forecast of the next 1 month, 3 months, or 10 years. News headlines appear only from a licensed feed. Global scenario is the local regime from Nifty and sector breadth — not geopolitics.",
  };
}
