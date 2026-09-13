import { findAsOfIndex } from "./trading-days";
import { periodReturn } from "./returns";
import { COST_SCENARIOS } from "@/config/alpha-defaults";

export type ExecutionTiming = "NEXT_SESSION" | "SAME_CLOSE";

/**
 * Signal generated from the close at `asOf`.
 * Default fill is the next bar (next session) to avoid same-day close leakage.
 */
export function entryIndex(
  bars: { date: string; close?: number }[],
  asOf: string,
  timing: ExecutionTiming = "NEXT_SESSION",
): number {
  const signal = findAsOfIndex(bars as { date: string; close: number }[], asOf);
  if (signal < 0) return -1;
  if (timing === "SAME_CLOSE") return signal;
  return signal + 1 < bars.length ? signal + 1 : -1;
}

export function nextSessionForward(
  bars: { date: string; close: number }[],
  asOf: string,
  holdTradingDays: number,
  timing: ExecutionTiming = "NEXT_SESSION",
): { entryDate: string; exitDate: string; grossReturn: number } | null {
  const ei = entryIndex(bars, asOf, timing);
  if (ei < 0) return null;
  const xi = ei + holdTradingDays;
  if (xi >= bars.length) return null;
  const gross = periodReturn(bars[xi].close, bars[ei].close);
  if (gross == null) return null;
  return { entryDate: bars[ei].date, exitDate: bars[xi].date, grossReturn: gross };
}

export function applyRoundTripCost(grossReturnPct: number, roundTripBps: number): number {
  return grossReturnPct - roundTripBps / 100;
}

export function costSensitivity(grossReturnPct: number) {
  return {
    low: applyRoundTripCost(grossReturnPct, COST_SCENARIOS.low.roundTripBps),
    base: applyRoundTripCost(grossReturnPct, COST_SCENARIOS.base.roundTripBps),
    high: applyRoundTripCost(grossReturnPct, COST_SCENARIOS.high.roundTripBps),
  };
}

export function assertSignalDoesNotUseFillBar(asOf: string, entryDate: string, timing: ExecutionTiming) {
  if (timing === "NEXT_SESSION" && entryDate <= asOf) {
    throw new Error(`Execution leakage: next-session fill ${entryDate} is not after signal ${asOf}`);
  }
}
