import { atr } from "./indicators";
import { sma, computeMaBundle } from "./moving-averages";
import type { PriceBar } from "./trading-days";

export type StructureLabel =
  | "FRESH_BREAKOUT"
  | "RECENT_BREAKOUT"
  | "COILED"
  | "TREND_CONTINUATION"
  | "FAILED_BREAKOUT"
  | "NO_SETUP";

export type StructureResult = {
  label: StructureLabel;
  close: number;
  priorHigh20: number | null;
  priorHigh55: number | null;
  distanceTo20HighPct: number | null;
  brokeOutToday: boolean;
  daysSinceBreakout: number | null;
  higherHighsHigherLows: boolean | null;
  rangeCompression: number | null;
  volumeRatio: number | null;
  volumeConfirms: boolean | null;
  trendState: string | null;
  why: string[];
  risks: string[];
};

const COIL_PCT = 2;
const LOOKBACK = 5;

function highs(bars: PriceBar[]) {
  return bars.map((b) => b.high ?? b.close);
}
function lows(bars: PriceBar[]) {
  return bars.map((b) => b.low ?? b.close);
}

export function priorWindowHigh(bars: PriceBar[], period: number): number | null {
  if (bars.length < period + 1) return null;
  const h = highs(bars).slice(bars.length - 1 - period, bars.length - 1);
  return h.length ? Math.max(...h) : null;
}

export function rangeCompression(bars: PriceBar[], short = 20, long = 55): number | null {
  if (bars.length < long) return null;
  const h = highs(bars);
  const l = lows(bars);
  const sH = Math.max(...h.slice(-short));
  const sL = Math.min(...l.slice(-short));
  const lH = Math.max(...h.slice(-long));
  const lL = Math.min(...l.slice(-long));
  const wide = lH - lL;
  if (wide <= 0) return null;
  return (sH - sL) / wide;
}

export function swingPivots(bars: PriceBar[], wing = 2) {
  const h = highs(bars);
  const l = lows(bars);
  const highsOut: { i: number; price: number }[] = [];
  const lowsOut: { i: number; price: number }[] = [];
  for (let i = wing; i < bars.length - wing; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - wing; j <= i + wing; j++) {
      if (j === i) continue;
      if (h[j] >= h[i]) isHigh = false;
      if (l[j] <= l[i]) isLow = false;
    }
    if (isHigh) highsOut.push({ i, price: h[i] });
    if (isLow) lowsOut.push({ i, price: l[i] });
  }
  return { highs: highsOut, lows: lowsOut };
}

export function higherHighsHigherLows(bars: PriceBar[]): boolean | null {
  const { highs: sh, lows: sl } = swingPivots(bars);
  if (sh.length < 2 || sl.length < 2) return null;
  const h1 = sh[sh.length - 2];
  const h2 = sh[sh.length - 1];
  const l1 = sl[sl.length - 2];
  const l2 = sl[sl.length - 1];
  return h2.price > h1.price && l2.price > l1.price;
}

function freshBreakoutAt(bars: PriceBar[], index: number, period: number): { yes: boolean; level: number | null } {
  if (index < period) return { yes: false, level: null };
  const window = bars.slice(0, index + 1);
  const level = priorWindowHigh(window, period);
  if (level == null) return { yes: false, level: null };
  const close = window[window.length - 1].close;
  const prev = window[window.length - 2]?.close;
  return { yes: close > level && prev != null && prev <= level, level };
}

export function analyzeStructure(bars: PriceBar[]): StructureResult | null {
  if (bars.length < 21) return null;
  const close = bars[bars.length - 1].close;
  const priorHigh20 = priorWindowHigh(bars, 20);
  const priorHigh55 = priorWindowHigh(bars, 55);
  const mas = computeMaBundle(bars);
  const hhhl = higherHighsHigherLows(bars);
  const compression = rangeCompression(bars);
  const vols = bars.map((b) => b.volume).filter((v): v is number => v != null && v > 0);
  const volSma = vols.length >= 20 ? sma(vols, 20) : null;
  const lastVol = bars[bars.length - 1].volume ?? null;
  const volumeRatio = lastVol != null && volSma ? lastVol / volSma : null;
  const volumeConfirms = volumeRatio == null ? null : volumeRatio >= 1.2;

  const today20 = freshBreakoutAt(bars, bars.length - 1, 20);
  const today55 = freshBreakoutAt(bars, bars.length - 1, 55);
  const brokeOutToday = today20.yes || today55.yes;

  let daysSinceBreakout: number | null = null;
  let recentStillHeld = false;
  let failed = false;
  for (let back = 1; back <= 10; back++) {
    const idx = bars.length - 1 - back;
    if (idx < 20) break;
    const ev = freshBreakoutAt(bars, idx, 20);
    if (!ev.yes || ev.level == null) continue;
    if (daysSinceBreakout == null) daysSinceBreakout = back;
    if (back <= LOOKBACK && close >= ev.level) recentStillHeld = true;
    if (close < ev.level * 0.995) failed = true;
  }
  if (brokeOutToday) daysSinceBreakout = 0;

  const distanceTo20HighPct =
    priorHigh20 != null && priorHigh20 > 0 ? ((priorHigh20 - close) / priorHigh20) * 100 : null;

  const coiled =
    !brokeOutToday &&
    !failed &&
    distanceTo20HighPct != null &&
    distanceTo20HighPct > 0 &&
    distanceTo20HighPct <= COIL_PCT &&
    (compression == null || compression <= 0.55) &&
    (mas.trendState === "UPTREND" || mas.trendState === "STRONG_UPTREND" || mas.trendState === "SIDEWAYS") &&
    (mas.priceVs50 == null || mas.priceVs50 > -3);

  const continuation =
    !brokeOutToday &&
    !failed &&
    priorHigh20 != null &&
    close > priorHigh20 &&
    (hhhl === true || mas.trendState === "UPTREND" || mas.trendState === "STRONG_UPTREND");

  let label: StructureLabel = "NO_SETUP";
  if (failed && !brokeOutToday) label = "FAILED_BREAKOUT";
  else if (brokeOutToday) label = "FRESH_BREAKOUT";
  else if (recentStillHeld) label = "RECENT_BREAKOUT";
  else if (coiled) label = "COILED";
  else if (continuation) label = "TREND_CONTINUATION";

  const why: string[] = [];
  const risks: string[] = [];
  if (brokeOutToday) {
    why.push(
      today55.yes
        ? `Close cleared the prior 55-session high (${priorHigh55?.toFixed(2)}).`
        : `Close cleared the prior 20-session high (${priorHigh20?.toFixed(2)}).`,
    );
  }
  if (recentStillHeld && daysSinceBreakout) why.push(`Broke the 20-session high ${daysSinceBreakout} sessions ago and is still above that level.`);
  if (coiled) why.push(`Within ${distanceTo20HighPct?.toFixed(1)}% of the 20-session high, range compressed — coiled, not a forecast.`);
  if (continuation) why.push("Already above the 20-session high with an uptrend or HH/HL structure.");
  if (hhhl === true) why.push("Last two swing highs and lows are rising (HH/HL).");
  if (hhhl === false) risks.push("Swing structure is not higher-highs / higher-lows.");
  if (volumeConfirms === true) why.push(`Volume ${volumeRatio!.toFixed(1)}× the 20-session average.`);
  if (volumeConfirms === false && (label === "FRESH_BREAKOUT" || label === "RECENT_BREAKOUT")) {
    risks.push("Breakout without volume confirmation — higher false-break risk.");
  }
  if (failed) risks.push("A recent 20-session break was given back (failed breakout).");
  if (mas.trendState === "DOWNTREND" || mas.trendState === "STRONG_DOWNTREND") {
    risks.push(`MA structure is ${mas.trendState.replaceAll("_", " ").toLowerCase()}.`);
  }
  const volAtr = atr(bars);
  if (volAtr != null && bars[bars.length - 1].high != null && bars[bars.length - 1].low != null) {
    const range = (bars[bars.length - 1].high ?? close) - (bars[bars.length - 1].low ?? close);
    if (label === "FRESH_BREAKOUT" && range < volAtr * 0.6) risks.push("Breakout bar is narrow versus ATR — weak expansion.");
  }
  if (!why.length && label === "NO_SETUP") why.push("No 20/55-session breakout, coil, or HH/HL continuation as of this close.");

  return {
    label,
    close,
    priorHigh20,
    priorHigh55,
    distanceTo20HighPct,
    brokeOutToday,
    daysSinceBreakout,
    higherHighsHigherLows: hhhl,
    rangeCompression: compression,
    volumeRatio,
    volumeConfirms,
    trendState: mas.trendState,
    why,
    risks,
  };
}
