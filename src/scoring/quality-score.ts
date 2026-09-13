import { QUALITY_WEIGHTS } from "@/config/terminal-defaults";
import { weightedAvailable } from "./weighted-score";

export function qualityScore(input: {
  roce?: number | null;
  roe?: number | null;
  fcf?: number | null;
  leverage?: number | null;
  margins?: number | null;
  consistency?: number | null;
}) {
  return weightedAvailable(
    {
      roce: input.roce,
      roe: input.roe,
      fcf: input.fcf,
      leverage: input.leverage,
      margins: input.margins,
      consistency: input.consistency,
    },
    QUALITY_WEIGHTS,
  );
}

/** Map a raw ratio into 0–100. Returns null if the input is missing. */
export function ratioToScore(value: number | null | undefined, good: number, bad: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (good === bad) return 50;
  const t = (value - bad) / (good - bad);
  return Math.max(0, Math.min(100, t * 100));
}
