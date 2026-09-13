export type OppClass =
  | "WATCHLIST"
  | "BEATEN_DOWN"
  | "FUNDAMENTALLY_ATTRACTIVE"
  | "EARLY_RECOVERY"
  | "CONFIRMED_RECOVERY"
  | "STRONG"
  | "OVEREXTENDED"
  | "VALUE_TRAP"
  | "FALLING_KNIFE"
  | "STRUCTURAL_WEAKNESS";

export function classifyOpportunity(input: {
  drawdown: number | null;
  quality: number | null;
  valuation: number | null;
  earnings: number | null;
  recovery: number | null;
  rs: number | null;
  vs200: number | null;
  return1m: number | null;
  return3m: number | null;
}): OppClass {
  const dd = input.drawdown ?? 0;
  const rec = input.recovery ?? 0;
  const q = input.quality;
  const e = input.earnings;
  const vs200 = input.vs200 ?? 0;
  const r1 = input.return1m ?? 0;
  const r3 = input.return3m ?? 0;

  if (dd >= 40 && vs200 < 0 && r1 < 0 && r3 < 0 && rec < 40) return "FALLING_KNIFE";
  if ((input.valuation ?? 50) >= 70 && (e ?? 50) < 40 && (q == null || q < 55)) return "VALUE_TRAP";
  if (dd >= 30 && rec >= 55 && r1 > -2) return "EARLY_RECOVERY";
  if (dd >= 30 && rec >= 70 && vs200 > -2) return "CONFIRMED_RECOVERY";
  if (dd >= 30 && rec < 35) return "BEATEN_DOWN";
  if ((q ?? 0) >= 70 && (input.valuation ?? 0) >= 60 && (e ?? 50) >= 55) return "FUNDAMENTALLY_ATTRACTIVE";
  if (dd < 8 && vs200 > 8 && r1 > 8) return "OVEREXTENDED";
  if (rec >= 65 && vs200 > 0) return "STRONG";
  if (dd >= 40 && rec < 45 && (e ?? 50) < 45) return "STRUCTURAL_WEAKNESS";
  return "WATCHLIST";
}

export function confidenceLabel(sample: number, dataQuality: number | null) {
  if (sample < 10) return { confidence: "Low", note: "Insufficient historical evidence." };
  if (sample < 20) return { confidence: "Low", note: "Small sample — low confidence." };
  if ((dataQuality ?? 100) < 40) return { confidence: "Low", note: "Data quality is incomplete; rank is not aggressive." };
  if (sample < 40) return { confidence: "Medium", note: `Historical sample: ${sample} comparable cases.` };
  return { confidence: "High", note: `Historical sample: ${sample} comparable cases.` };
}
