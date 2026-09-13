import { clamp } from "@/lib/utils";

/**
 * Continuous score: distanceFromAth / 60 * 100, capped at 100.
 * Also expose a piecewise reference used only for diagnostics.
 */
export function continuousDrawdownScore(distanceFromAth: number): number {
  return clamp((distanceFromAth / 60) * 100, 0, 100);
}

export function piecewiseDrawdownScore(distanceFromAth: number): number {
  const d = distanceFromAth;
  if (d < 0) return 0;
  if (d < 10) return 10;
  if (d < 20) return 20;
  if (d < 30) return 35;
  if (d < 40) return 50;
  if (d < 50) return 70;
  if (d < 60) return 85;
  return 100;
}

export function drawdownScore(distanceFromAth: number): {
  continuous: number;
  piecewise: number;
  blended: number;
} {
  const continuous = continuousDrawdownScore(distanceFromAth);
  const piecewise = piecewiseDrawdownScore(distanceFromAth);
  return {
    continuous,
    piecewise,
    blended: clamp(continuous * 0.7 + piecewise * 0.3, 0, 100),
  };
}
