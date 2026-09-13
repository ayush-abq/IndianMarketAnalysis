import { MIN_SAMPLE_SIZE, SMALL_SAMPLE_SIZE } from "@/config/alpha-defaults";

export type OutcomeSample = {
  returns: number[];
  outOfSampleReturns?: number[];
};

export function expectedValue(returns: number[]) {
  const n = returns.length;
  if (!n) {
    return {
      expectedReturn: null,
      pGain: null,
      pLoss: null,
      avgGain: null,
      avgLoss: null,
      median: null,
      best: null,
      worst: null,
      sample: 0,
      note: "No completed historical outcomes.",
    };
  }
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r < 0);
  const pGain = wins.length / n;
  const pLoss = losses.length / n;
  const avgGain = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
  const ev = pGain * avgGain - pLoss * avgLoss;
  const sorted = [...returns].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    expectedReturn: ev,
    pGain: pGain * 100,
    pLoss: pLoss * 100,
    avgGain,
    avgLoss: losses.length ? -avgLoss : 0,
    median,
    best: sorted[sorted.length - 1],
    worst: sorted[0],
    sample: n,
    note:
      n < MIN_SAMPLE_SIZE
        ? `Historical sample: ${n} — insufficient evidence. Do not treat EV as usable.`
        : "Historical expected value of completed outcomes after the configured execution/cost assumptions. Not a forecast.",
  };
}

export function evidenceStrength(input: {
  sample: number;
  winRate: number | null;
  oosSample?: number;
  oosWinRate?: number | null;
  parameterStable?: boolean;
}) {
  const { sample, winRate, oosSample = 0, oosWinRate, parameterStable = true } = input;
  if (sample < MIN_SAMPLE_SIZE) return { level: "Very Weak" as const, reason: `Only ${sample} observations.` };
  if (sample < SMALL_SAMPLE_SIZE) return { level: "Weak" as const, reason: "Small sample — low confidence." };
  const oosOk = oosSample >= MIN_SAMPLE_SIZE && (oosWinRate == null || (winRate != null && oosWinRate >= winRate - 15));
  if (sample >= 80 && oosOk && parameterStable && (winRate ?? 0) >= 55) {
    return { level: "Very Strong" as const, reason: "Large sample, out-of-sample held, parameters not a knife-edge." };
  }
  if (sample >= 40 && (oosOk || parameterStable) && (winRate ?? 0) >= 52) {
    return { level: "Strong" as const, reason: "Adequate sample with supportive consistency." };
  }
  if (oosSample >= MIN_SAMPLE_SIZE && oosWinRate != null && winRate != null && oosWinRate < winRate - 15) {
    return { level: "Weak" as const, reason: "Out-of-sample hit rate deteriorated versus in-sample." };
  }
  return { level: "Moderate" as const, reason: `Historical sample ${sample}. Treat as research, not proof.` };
}

export function alphaDecay(horizonReturns: Record<string, number[]>) {
  const rows = Object.entries(horizonReturns).map(([horizon, rets]) => {
    const ev = expectedValue(rets);
    return { horizon, median: ev.median, expectedReturn: ev.expectedReturn, sample: ev.sample };
  });
  const usable = rows.filter((r) => r.median != null && r.sample >= MIN_SAMPLE_SIZE);
  let halfLife: string | null = null;
  if (usable.length >= 2) {
    const first = usable[0].median!;
    const half = usable.find((r) => Math.abs(r.median!) <= Math.abs(first) / 2);
    halfLife = half?.horizon ?? null;
  }
  return {
    rows,
    halfLife,
    note: "Median subsequent return by horizon after next-session entry. Short-lived vs persistent is historical, not a forecast.",
  };
}

export function rankRobustness(input: {
  cagr: number | null;
  maxDrawdown: number | null;
  oosCagr: number | null;
  sharpe: number | null;
}) {
  const dd = Math.abs(input.maxDrawdown ?? 100);
  const oos = input.oosCagr ?? -999;
  const ins = input.cagr ?? 0;
  if (dd >= 50 && oos < ins - 10) return { rankHint: "fragile", note: "Large drawdown and weak out-of-sample — do not prefer this over a duller robust screen." };
  if (dd <= 25 && oos > -999 && oos >= ins - 5) return { rankHint: "robust", note: "Prefer robust out-of-sample profiles over the highest in-sample CAGR." };
  return { rankHint: "mixed", note: "Compare out-of-sample and drawdown before ranking by return." };
}
