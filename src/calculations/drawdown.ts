import { calculateAth, pickAth } from "./ath";
import type { PriceBar } from "./trading-days";
import type { DRAWDOWN_THRESHOLDS } from "@/config/defaults";

export type DrawdownBucket =
  | "NORMAL"
  | "CORRECTION"
  | "DEEP_CORRECTION"
  | "BEAR_MARKET"
  | "EXTREME_DRAWDOWN"
  | "CAPITULATION_ZONE";

export type DrawdownResult = {
  currentClose: number;
  ath: number;
  athDate: string;
  closingAth: number;
  closingAthDate: string;
  intradayAth: number | null;
  intradayAthDate: string | null;
  drawdownPercent: number;
  drawdownAmount: number;
  distanceFromAthPercent: number;
  bucket: DrawdownBucket;
  high52w: number | null;
  low52w: number | null;
  drawdown52wPercent: number | null;
};

export function classifyDrawdown(
  distanceFromAth: number,
  thresholds: typeof DRAWDOWN_THRESHOLDS,
): DrawdownBucket {
  if (distanceFromAth >= thresholds.capitulation) return "CAPITULATION_ZONE";
  if (distanceFromAth >= thresholds.extreme_drawdown) return "EXTREME_DRAWDOWN";
  if (distanceFromAth >= thresholds.bear_market) return "BEAR_MARKET";
  if (distanceFromAth >= thresholds.deep_correction) return "DEEP_CORRECTION";
  if (distanceFromAth >= thresholds.correction) return "CORRECTION";
  return "NORMAL";
}

export function calculateDrawdown(
  barsThroughDate: PriceBar[],
  thresholds: typeof DRAWDOWN_THRESHOLDS,
  methodology: "closing" | "intraday" = "closing",
): DrawdownResult | null {
  if (!barsThroughDate.length) return null;
  const current = barsThroughDate[barsThroughDate.length - 1];
  const ath = calculateAth(barsThroughDate);
  if (!ath) return null;

  const chosen = pickAth(ath, methodology);
  const drawdownPercent = ((current.close - chosen.value) / chosen.value) * 100;
  const distanceFromAthPercent = ((chosen.value - current.close) / chosen.value) * 100;

  const window = barsThroughDate.slice(-252);
  let high52w: number | null = null;
  let low52w: number | null = null;
  if (window.length) {
    high52w = Math.max(...window.map((b) => b.close));
    low52w = Math.min(...window.map((b) => b.close));
  }
  const drawdown52wPercent =
    high52w && high52w > 0 ? ((high52w - current.close) / high52w) * 100 : null;

  return {
    currentClose: current.close,
    ath: chosen.value,
    athDate: chosen.date,
    closingAth: ath.closingAth,
    closingAthDate: ath.closingAthDate,
    intradayAth: ath.intradayAth,
    intradayAthDate: ath.intradayAthDate,
    drawdownPercent,
    drawdownAmount: chosen.value - current.close,
    distanceFromAthPercent,
    bucket: classifyDrawdown(distanceFromAthPercent, thresholds),
    high52w,
    low52w,
    drawdown52wPercent,
  };
}

export function runningDrawdownSeries(
  bars: PriceBar[],
  methodology: "closing" | "intraday" = "closing",
): { date: string; drawdownPercent: number; distanceFromAth: number }[] {
  let peak = -Infinity;
  const out: { date: string; drawdownPercent: number; distanceFromAth: number }[] = [];
  for (const bar of bars) {
    const value = methodology === "intraday" && bar.high != null ? Math.max(bar.high, bar.close) : bar.close;
    if (value > peak) peak = value;
    if (peak <= 0) continue;
    const dd = ((bar.close - peak) / peak) * 100;
    out.push({
      date: bar.date,
      drawdownPercent: dd,
      distanceFromAth: -dd,
    });
  }
  return out;
}
