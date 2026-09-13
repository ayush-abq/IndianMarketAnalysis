export type MarketContext = {
  asOf: string;
  entity: { type: "STOCK" | "INDEX" | "FUND"; id: number; name: string; symbol?: string | null };
  regime: { label: string | null; score: number | null };
  breadth: Record<string, number | null>;
  sector: { name: string | null; signal: string | null; return1y: number | null; drawdown: number | null };
  fundamentals: Record<string, number | null | string>;
  earnings: Record<string, number | null | string>;
  valuation: Record<string, number | null | string>;
  technicals: Record<string, number | null | string>;
  relativeStrength: Record<string, number | null>;
  institutionalFlows: Record<string, number | null | string>;
  catalysts: string[];
  portfolioExposure: Record<string, unknown> | null;
  historicalAnalogues: {
    comparable: number;
    median6m: number | null;
    median12m: number | null;
    note: string;
    fabricated: false;
  } | null;
  ml: Record<string, unknown> | null;
  risk: Record<string, number | null | string>;
  dataQuality: { score: number | null; missing: string[]; note: string };
};

export function compactContext(ctx: MarketContext) {
  return JSON.stringify(ctx, null, 2);
}

export function contextGuardrail() {
  return [
    "You are a local research assistant. Use ONLY the supplied MarketContext JSON.",
    "Never invent prices, returns, PE, ROE, AUM, TER, probabilities, hit rates, or analogues.",
    "If a field is null or 'N/A', say it is unavailable. Do not treat missing as zero.",
    "Never recommend buy or sell. Use: historical probability, model estimate, scenario, research signal, uncertainty.",
    "Never say guaranteed profit, certain to rise, risk-free, or guaranteed target.",
    "If your wording conflicts with a number in MarketContext, the database number wins.",
    "Do not query the internet. Do not browse. Reason only over this JSON and approved excerpts.",
  ].join(" ");
}
