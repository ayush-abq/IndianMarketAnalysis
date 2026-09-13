import type { SIGNAL_THRESHOLDS } from "@/config/defaults";
import type { TrendState } from "@/calculations/moving-averages";

export type ResearchSignal =
  | "FALLING_KNIFE"
  | "EARLY_RECOVERY"
  | "STRUCTURAL_WEAKNESS"
  | "POSSIBLE_CAPITULATION"
  | "RECOVERING"
  | "IMPROVING"
  | "STRONG"
  | "WEAK_MOMENTUM"
  | "NOT_QUALIFYING";

export type SignalInput = {
  distanceFromAth: number;
  return1m: number | null;
  return3m: number | null;
  return1y: number | null;
  return2y: number | null;
  return5y: number | null;
  priceVs200: number | null;
  ma200Slope: number | null;
  rs1m: number | null;
  rs3m: number | null;
  rs1y: number | null;
  priceVs50: number | null;
  crossed50: boolean;
  recoveryScore: number;
  volPercentile: number | null;
  return20d: number | null;
  trendState: TrendState;
};

export function detectFallingKnife(s: SignalInput, t: typeof SIGNAL_THRESHOLDS): boolean {
  const mom1m = s.return1m ?? 0;
  const mom3m = s.return3m ?? 0;
  const rsDeteriorating = (s.rs1m ?? 0) < 0 && (s.rs3m ?? 0) < 0;
  return (
    s.distanceFromAth >= t.falling_knife_drawdown &&
    mom1m <= -8 &&
    mom3m <= -12 &&
    (s.priceVs200 ?? 0) < 0 &&
    (s.ma200Slope ?? 0) < 0 &&
    rsDeteriorating
  );
}

export function detectEarlyRecovery(s: SignalInput, t: typeof SIGNAL_THRESHOLDS): boolean {
  const momentumImproving = (s.return1m ?? -99) > 0 || (s.return20d ?? -99) > 0;
  const rsImproving = (s.rs1m ?? -99) > (s.rs3m ?? -99) || (s.rs1m ?? 0) > 0;
  return (
    s.distanceFromAth >= t.early_recovery_drawdown &&
    momentumImproving &&
    (s.crossed50 || (s.priceVs50 ?? -99) > 0 || (s.return3m ?? -99) > 0) &&
    rsImproving
  );
}

export function detectStructuralWeakness(s: SignalInput): boolean {
  return (
    (s.return5y ?? 1) < 0 &&
    (s.return2y ?? 1) < 0 &&
    (s.return1y ?? 1) < 0 &&
    (s.priceVs200 ?? 1) < 0
  );
}

export function detectPossibleCapitulation(s: SignalInput, t: typeof SIGNAL_THRESHOLDS): boolean {
  const volElevated = (s.volPercentile ?? 0) >= t.elevated_volatility_percentile;
  const largeDecline = (s.return1m ?? 0) <= t.large_recent_decline_1m;
  const stabilizing =
    (s.return20d ?? -99) > (s.return1m ?? 0) || s.trendState === "SIDEWAYS" || s.recoveryScore >= 35;
  return (
    s.distanceFromAth >= t.capitulation_drawdown &&
    (s.return1y ?? 0) <= t.capitulation_return_1y &&
    (volElevated || largeDecline) &&
    (largeDecline || stabilizing)
  );
}

export function resolveSignal(s: SignalInput, t: typeof SIGNAL_THRESHOLDS): ResearchSignal {
  const falling = detectFallingKnife(s, t);
  const early = detectEarlyRecovery(s, t);
  const structural = detectStructuralWeakness(s);
  const cap = detectPossibleCapitulation(s, t);

  if (falling && !early) return "FALLING_KNIFE";
  if (early) return "EARLY_RECOVERY";
  if (structural && s.distanceFromAth >= 30) return "STRUCTURAL_WEAKNESS";
  if (cap) return "POSSIBLE_CAPITULATION";
  if (s.recoveryScore >= 65 && s.distanceFromAth >= 20) return "RECOVERING";
  if (s.recoveryScore >= 45 && s.distanceFromAth >= 15) return "IMPROVING";
  if (s.distanceFromAth < 15 && (s.priceVs200 ?? 0) > 0 && (s.return1y ?? 0) > 0) return "STRONG";
  if (s.distanceFromAth < 20) return "NOT_QUALIFYING";
  return "WEAK_MOMENTUM";
}

export function signalLabel(signal: ResearchSignal): string {
  switch (signal) {
    case "FALLING_KNIFE":
      return "Deeply beaten down but still falling";
    case "EARLY_RECOVERY":
      return "Early recovery candidate";
    case "STRUCTURAL_WEAKNESS":
      return "Structural weakness";
    case "POSSIBLE_CAPITULATION":
      return "Possible capitulation";
    case "RECOVERING":
      return "Recovering";
    case "IMPROVING":
      return "Improving";
    case "STRONG":
      return "Strong";
    case "WEAK_MOMENTUM":
      return "Weak momentum";
    default:
      return "Not qualifying";
  }
}

export function classificationFromState(input: {
  bucket: string;
  signal: ResearchSignal;
  opportunityLabel: string;
}): string {
  if (input.signal === "FALLING_KNIFE") return "FALLING_KNIFE";
  if (input.signal === "EARLY_RECOVERY") return "EARLY_RECOVERY";
  if (input.signal === "STRUCTURAL_WEAKNESS") return "STRUCTURAL_WEAKNESS";
  if (input.signal === "POSSIBLE_CAPITULATION") return "POSSIBLE_CAPITULATION";
  if (input.signal === "RECOVERING") return "RECOVERING";
  if (input.signal === "STRONG") return "STRONG";
  if (input.bucket === "CAPITULATION_ZONE" || input.bucket === "EXTREME_DRAWDOWN") return "EXTREME_DRAWDOWN";
  if (input.bucket === "BEAR_MARKET") return "DEEPLY_BEATEN_DOWN";
  if (input.bucket === "DEEP_CORRECTION" || input.bucket === "CORRECTION") return "WEAK";
  return "NOT_QUALIFYING";
}
