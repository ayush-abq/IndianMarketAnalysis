/**
 * Groww-style technical overview from official EOD tape only.
 * Verdicts: Bullish / Neutral / Bearish. Not a buy or sell call.
 */

export type Stance = "BULLISH" | "NEUTRAL" | "BEARISH";

export type IndicatorReading = {
  key: string;
  label: string;
  verdict: Stance;
  detail: string;
};

export type TechnicalOverview = {
  overall: Stance;
  score: number;
  probabilities: { bullish: number; neutral: number; bearish: number };
  indicators: IndicatorReading[];
  note: string;
};

export function rsiStance(rsi: number | null): IndicatorReading {
  if (rsi == null) return { key: "rsi", label: "RSI (14)", verdict: "NEUTRAL", detail: "Not enough closes yet." };
  if (rsi >= 70) return { key: "rsi", label: "RSI (14)", verdict: "BEARISH", detail: `${rsi.toFixed(0)} — overbought on Groww’s 70 line.` };
  if (rsi <= 30) return { key: "rsi", label: "RSI (14)", verdict: "BULLISH", detail: `${rsi.toFixed(0)} — oversold on Groww’s 30 line.` };
  if (rsi >= 55) return { key: "rsi", label: "RSI (14)", verdict: "BULLISH", detail: `${rsi.toFixed(0)} — above 50, momentum is up.` };
  if (rsi <= 45) return { key: "rsi", label: "RSI (14)", verdict: "BEARISH", detail: `${rsi.toFixed(0)} — below 50, momentum is down.` };
  return { key: "rsi", label: "RSI (14)", verdict: "NEUTRAL", detail: `${rsi.toFixed(0)} — mid-range, sideways heat.` };
}

export function maStance(key: string, label: string, priceVs: number | null): IndicatorReading {
  if (priceVs == null) return { key, label, verdict: "NEUTRAL", detail: "Average not computed yet." };
  if (priceVs > 0.5) return { key, label, verdict: "BULLISH", detail: `${priceVs.toFixed(1)}% above the average.` };
  if (priceVs < -0.5) return { key, label, verdict: "BEARISH", detail: `${Math.abs(priceVs).toFixed(1)}% below the average.` };
  return { key, label, verdict: "NEUTRAL", detail: "Hugging the average." };
}

export function returnStance(key: string, label: string, ret: number | null): IndicatorReading {
  if (ret == null) return { key, label, verdict: "NEUTRAL", detail: "Not enough history." };
  if (ret > 1) return { key, label, verdict: "BULLISH", detail: `${ret > 0 ? "+" : ""}${ret.toFixed(1)}% over this window.` };
  if (ret < -1) return { key, label, verdict: "BEARISH", detail: `${ret.toFixed(1)}% over this window.` };
  return { key, label, verdict: "NEUTRAL", detail: "Flat over this window." };
}

export function trendStance(trendState: string | null | undefined): IndicatorReading {
  const t = (trendState ?? "").toUpperCase();
  if (t === "STRONG_UPTREND" || t === "UPTREND") {
    return { key: "trend", label: "Moving averages", verdict: "BULLISH", detail: "Close is above the short and long averages." };
  }
  if (t === "STRONG_DOWNTREND" || t === "DOWNTREND") {
    return { key: "trend", label: "Moving averages", verdict: "BEARISH", detail: "Close is below the short and long averages." };
  }
  if (t === "SIDEWAYS") {
    return { key: "trend", label: "Moving averages", verdict: "NEUTRAL", detail: "Short and long averages disagree — sideways." };
  }
  return { key: "trend", label: "Moving averages", verdict: "NEUTRAL", detail: "Trend not classified yet." };
}

export function inferTrendState(priceVs50: number | null, priceVs200: number | null): string | null {
  if (priceVs50 == null || priceVs200 == null) return null;
  if (priceVs50 > 0 && priceVs200 > 0) return "UPTREND";
  if (priceVs50 < 0 && priceVs200 < 0) return "DOWNTREND";
  return "SIDEWAYS";
}

export function technicalOverview(input: {
  rsi?: number | null;
  priceVs50?: number | null;
  priceVs200?: number | null;
  return1m?: number | null;
  return3m?: number | null;
  trendState?: string | null;
}): TechnicalOverview {
  const trend = input.trendState ?? inferTrendState(input.priceVs50 ?? null, input.priceVs200 ?? null);
  const candidates = [
    input.rsi != null ? rsiStance(input.rsi) : null,
    input.priceVs50 != null ? maStance("dma50", "50-DMA", input.priceVs50) : null,
    input.priceVs200 != null ? maStance("dma200", "200-DMA", input.priceVs200) : null,
    input.return1m != null ? returnStance("return1m", "1-month return", input.return1m) : null,
    input.return3m != null ? returnStance("return3m", "3-month return", input.return3m) : null,
    trend ? trendStance(trend) : null,
  ];
  const indicators = candidates.filter((i): i is IndicatorReading => i != null);

  const usable = indicators.length ? indicators : [{ key: "none", label: "Tape", verdict: "NEUTRAL" as const, detail: "Need more official closes." }];
  const bullish = usable.filter((i) => i.verdict === "BULLISH").length;
  const bearish = usable.filter((i) => i.verdict === "BEARISH").length;
  const neutral = usable.filter((i) => i.verdict === "NEUTRAL").length;
  const n = usable.length;
  const probabilities = {
    bullish: Math.round((bullish / n) * 100),
    neutral: Math.round((neutral / n) * 100),
    bearish: Math.round((bearish / n) * 100),
  };
  const drift = 100 - probabilities.bullish - probabilities.neutral - probabilities.bearish;
  probabilities.neutral += drift;

  let overall: Stance = "NEUTRAL";
  if (bullish > bearish && bullish > neutral) overall = "BULLISH";
  else if (bearish > bullish && bearish > neutral) overall = "BEARISH";

  return {
    overall,
    score: probabilities.bullish,
    probabilities,
    indicators: usable,
    note: "Groww-style Bullish / Neutral / Bearish from official closes only. Research snapshot — not a buy or sell.",
  };
}

export function blendModelChances(input: {
  rise?: number | null;
  fall20?: number | null;
}): { bullish: number | null; bearish: number | null; neutral: number | null } {
  const rise = input.rise != null && Number.isFinite(input.rise) ? Math.min(1, Math.max(0, input.rise)) : null;
  const fall = input.fall20 != null && Number.isFinite(input.fall20) ? Math.min(1, Math.max(0, input.fall20)) : null;
  if (rise == null && fall == null) return { bullish: null, bearish: null, neutral: null };
  const bullish = rise;
  const bearish = fall;
  const leftover = 1 - (bullish ?? 0) - (bearish ?? 0);
  return {
    bullish: bullish != null ? Math.round(bullish * 100) : null,
    bearish: bearish != null ? Math.round(bearish * 100) : null,
    neutral: leftover > 0.02 ? Math.round(leftover * 100) : leftover > 0 ? Math.round(leftover * 100) : 0,
  };
}

export function stanceLabel(s: Stance) {
  if (s === "BULLISH") return "Bullish";
  if (s === "BEARISH") return "Bearish";
  return "Neutral";
}
