import type { ResearchSignal } from "@/scoring/signals";
import { explainMarketReading, explanationToNote } from "@/services/explain";

export type NoteMetrics = {
  name: string;
  distanceFromAth: number;
  athDate: string;
  return1y: number | null;
  return2y: number | null;
  return5y: number | null;
  return1m?: number | null;
  return3m: number | null;
  priceVs50?: number | null;
  priceVs200: number | null;
  rs1yNifty50: number | null;
  recoveryScore: number;
  signal: ResearchSignal;
  trendState?: string | null;
};

/**
 * Deterministic research note generated only from computed metrics.
 * Never invents numbers or news headlines.
 */
export function generateResearchNote(m: NoteMetrics): string {
  return explanationToNote(
    explainMarketReading({
      kind: "INDEX",
      name: m.name,
      signal: m.signal,
      return1m: m.return1m,
      return3m: m.return3m,
      return1y: m.return1y,
      return2y: m.return2y,
      return5y: m.return5y,
      priceVs50: m.priceVs50,
      priceVs200: m.priceVs200,
      rs1y: m.rs1yNifty50,
      drawdown: m.distanceFromAth,
      recovery: m.recoveryScore,
      trendState: m.trendState,
    }),
  );
}
