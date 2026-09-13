export type RecoveryStage = 0 | 1 | 2 | 3 | 4 | 5;

export const RECOVERY_STAGE_LABEL: Record<RecoveryStage, string> = {
  0: "Collapse",
  1: "Capitulation",
  2: "Stabilization",
  3: "Early Recovery",
  4: "Confirmed Recovery",
  5: "Momentum Expansion",
};

export function recoveryStage(input: {
  drawdown: number | null;
  return1m: number | null;
  return3m: number | null;
  vs200: number | null;
  recovery: number | null;
  rs: number | null;
}): RecoveryStage {
  const dd = input.drawdown ?? 0;
  const r1 = input.return1m ?? 0;
  const r3 = input.return3m ?? 0;
  const vs200 = input.vs200 ?? 0;
  const rec = input.recovery ?? 0;
  const rs = input.rs ?? 0;

  if (dd >= 45 && r1 < -8 && rec < 30) return 0;
  if (dd >= 40 && r1 < -4 && rec < 40) return 1;
  if (dd >= 25 && Math.abs(r1) <= 4 && rec >= 35 && rec < 55) return 2;
  if (dd >= 25 && rec >= 55 && r1 > -2 && vs200 < 4) return 3;
  if (dd >= 15 && rec >= 70 && vs200 > -2 && r3 > -5) return 4;
  if (vs200 > 2 && rec >= 65 && rs > 0 && r1 > 0) return 5;
  if (dd >= 30 && rec < 35) return 1;
  if (dd >= 20) return 2;
  return rec >= 60 ? 4 : 2;
}

export function fallenAngelScore(input: {
  drawdown: number | null;
  quality: number | null;
  earnings: number | null;
  recovery: number | null;
  vs200: number | null;
}): number | null {
  const dd = input.drawdown;
  if (dd == null || dd < 25) return null;
  const q = input.quality;
  const e = input.earnings;
  if (q == null && e == null) {
    return Math.max(0, Math.min(100, dd * 0.8 + (input.recovery ?? 0) * 0.2));
  }
  if ((q ?? 0) < 45 || (e != null && e < 35)) return Math.min(35, dd * 0.4);
  return Math.max(0, Math.min(100, dd * 0.5 + (q ?? 50) * 0.3 + (input.recovery ?? 40) * 0.2));
}

export function falseRecoveryRisk(input: {
  return1m: number | null;
  recovery: number | null;
  vs200: number | null;
  earnings: number | null;
  quality: number | null;
  rs: number | null;
}): { flag: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const priceUp = (input.return1m ?? 0) > 2;
  if (!priceUp) return { flag: false, reasons };
  if ((input.earnings != null && input.earnings < 40) || (input.quality != null && input.quality < 40)) {
    reasons.push("Price bounced without supportive fundamentals.");
  }
  if ((input.recovery ?? 100) < 45) reasons.push("Recovery score remains weak.");
  if ((input.vs200 ?? 0) < -8) reasons.push("Still well below the 200DMA.");
  if ((input.rs ?? 0) < 0) reasons.push("Relative strength has not confirmed.");
  return { flag: reasons.length >= 2, reasons };
}
