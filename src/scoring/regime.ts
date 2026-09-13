export type Regime = "BULL" | "BEAR" | "CORRECTION" | "RECOVERY" | "SIDEWAYS" | "HIGH_VOLATILITY" | "NEUTRAL";

export function detectRegime(input: {
  nifty50Return1y: number | null;
  nifty50Return6m: number | null;
  nifty50PriceVs200: number | null;
  nifty500Return1y: number | null;
}): Regime {
  return detectMarketRegime({
    nifty50Return1y: input.nifty50Return1y,
    nifty50Return6m: input.nifty50Return6m,
    nifty50Return1m: null,
    nifty50PriceVs50: null,
    nifty50PriceVs200: input.nifty50PriceVs200,
    nifty50Drawdown: null,
    nifty500Return1y: input.nifty500Return1y,
  }).regime;
}

export function detectMarketRegime(input: {
  nifty50Return1y: number | null;
  nifty50Return6m: number | null;
  nifty50Return1m: number | null;
  nifty50PriceVs50: number | null;
  nifty50PriceVs200: number | null;
  nifty50Drawdown: number | null;
  nifty500Return1y: number | null;
  indiaVix?: number | null;
  sectorPctAbove200?: number | null;
  sectorPctBelow30?: number | null;
  recoveringSectors?: number | null;
  fallingSectors?: number | null;
}): { regime: Regime; score: number; why: string[]; risks: string[] } {
  const y1 = input.nifty50Return1y ?? input.nifty500Return1y ?? 0;
  const m6 = input.nifty50Return6m ?? 0;
  const m1 = input.nifty50Return1m ?? 0;
  const vs200 = input.nifty50PriceVs200 ?? 0;
  const dd = input.nifty50Drawdown ?? 0;
  const vix = input.indiaVix;
  const above200 = input.sectorPctAbove200;
  const below30 = input.sectorPctBelow30 ?? 0;
  const recovering = input.recoveringSectors ?? 0;
  const falling = input.fallingSectors ?? 0;
  const why: string[] = [];
  const risks: string[] = [];

  let regime: Regime = "NEUTRAL";
  if (vix != null && vix >= 20) {
    regime = "HIGH_VOLATILITY";
    why.push(`India VIX ${vix.toFixed(1)} is elevated.`);
  } else if (y1 > 8 && m6 > 0 && vs200 > 0 && dd < 12) {
    regime = "BULL";
    why.push("Nifty 50 is above the 200DMA with positive 6M/1Y returns and a shallow drawdown.");
  } else if (y1 < -8 && vs200 < 0 && dd >= 20) {
    regime = "BEAR";
    why.push("Nifty 50 is below the 200DMA with a weak 1Y return and a >20% drawdown.");
  } else if (dd >= 10 && dd < 20 && vs200 < 0) {
    regime = "CORRECTION";
    why.push(`Index drawdown ${dd.toFixed(1)}% with price below the 200DMA.`);
  } else if (dd >= 12 && (m1 > 0 || recovering > falling) && vs200 < 2) {
    regime = "RECOVERY";
    why.push("Drawdown remains material but short-term returns or sector recovery breadth is improving.");
  } else if (Math.abs(y1) < 8 && Math.abs(m6) < 6) {
    regime = "SIDEWAYS";
    why.push("1Y and 6M index returns are contained — no strong directional regime.");
  } else {
    why.push("Mixed index trend, drawdown and sector breadth — classified Neutral.");
  }

  let score = 50;
  score += Math.max(-20, Math.min(20, y1));
  score += vs200 > 0 ? 8 : -8;
  score += dd >= 20 ? -12 : dd >= 10 ? -6 : 4;
  if (above200 != null) score += (above200 - 50) * 0.2;
  score -= below30 * 0.3;
  score += recovering * 2 - falling * 2;
  if (vix != null && vix >= 20) score -= 10;
  score = Math.max(0, Math.min(100, score));

  if (below30 >= 15) risks.push("A large share of sectors remain >30% below ATH.");
  if (falling > recovering) risks.push("More sectors are labelled falling knife than early recovery.");
  if (vs200 < 0) risks.push("Nifty 50 is below its 200DMA.");
  if (!risks.length) risks.push("See component scores. Regime is context, not a trade signal.");

  return { regime, score, why, risks };
}

export function capitulationScore(input: {
  distanceFromAth: number;
  return1y: number | null;
  volPercentile: number | null;
  return1m: number | null;
  recoveryScore: number;
}): number {
  let score = 0;
  if (input.distanceFromAth >= 60) score += 35;
  else if (input.distanceFromAth >= 50) score += 25;
  else if (input.distanceFromAth >= 40) score += 12;
  if ((input.return1y ?? 0) <= -35) score += 25;
  else if ((input.return1y ?? 0) <= -25) score += 15;
  if ((input.volPercentile ?? 0) >= 80) score += 20;
  else if ((input.volPercentile ?? 0) >= 65) score += 10;
  if ((input.return1m ?? 0) <= -10) score += 15;
  if (input.recoveryScore >= 30 && input.recoveryScore <= 55) score += 5;
  return Math.min(100, score);
}

export function classifyBreadthDivergence(input: {
  indexReturn1m: number | null;
  sectorPctAbove50: number | null;
  prevSectorPctAbove50: number | null;
}) {
  const idx = input.indexReturn1m;
  const now = input.sectorPctAbove50;
  const prev = input.prevSectorPctAbove50;
  if (idx == null || now == null || prev == null) return null;
  if (idx > 0 && now < prev - 5) return "NEGATIVE_BREADTH_DIVERGENCE";
  if (idx < 0 && now > prev + 5) return "POSITIVE_BREADTH_DIVERGENCE";
  return null;
}
