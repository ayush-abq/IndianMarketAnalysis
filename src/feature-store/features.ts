import { calculateReturns } from "@/calculations/returns";
import { calculateDrawdown } from "@/calculations/drawdown";
import { computeMaBundle } from "@/calculations/moving-averages";
import { rsi, rsScore } from "@/calculations/indicators";
import { realizedVol20d } from "@/calculations/volatility";
import { recoveryScore } from "@/scoring/recovery-score";
import { momentumScore } from "@/scoring/momentum-score";
import { DRAWDOWN_THRESHOLDS } from "@/config/defaults";
import { FEATURE_KEYS, FEATURE_SET_VERSION, type FeatureKey } from "@/config/local-ai";
import { sliceThrough, type PriceBar } from "@/calculations/trading-days";
import { DEFAULT_SETTINGS } from "@/config/defaults";

export type FeatureRow = {
  asOf: string;
  availableAt: string;
  version: string;
  values: Record<FeatureKey, number | null>;
  sources: Record<string, string>;
};

export function featuresFromBars(
  bars: PriceBar[],
  asOf: string,
  extras?: {
    sectorReturn1y?: number | null;
    regimeScore?: number | null;
    quality?: number | null;
    valuation?: number | null;
    earnings?: number | null;
    pe?: number | null;
    pb?: number | null;
    roe?: number | null;
    roce?: number | null;
    fundamentalAvailableAt?: string | null;
  },
): FeatureRow | null {
  const through = sliceThrough(bars, asOf);
  if (through.length < 30) return null;
  const last = through[through.length - 1];
  const returns = calculateReturns(through);
  const dd = calculateDrawdown(through, DRAWDOWN_THRESHOLDS, "closing");
  const mas = computeMaBundle(through);
  const closes = through.map((b) => b.close);
  const vols = through.map((b) => b.volume ?? null);
  const vol20 = realizedVol20d(through);
  const avgVol =
    vols.slice(-20).filter((v): v is number => v != null).reduce((a, b) => a + b, 0) /
    Math.max(1, vols.slice(-20).filter((v) => v != null).length);
  const lastVol = vols.at(-1);
  const rec = recoveryScore(
    {
      recoveryFromTroughPct: dd?.drawdown52wPercent != null ? Math.max(0, 100 - dd.drawdown52wPercent) : null,
      return5d: returns.d5,
      return20d: returns.d20,
      priceVs50: mas.priceVs50,
      priceVs200: mas.priceVs200,
      return3m: returns.m3,
      return6m: returns.m6,
      rs1m: extras?.sectorReturn1y != null && returns.m1 != null ? returns.m1 - extras.sectorReturn1y : null,
      crossed50: mas.cross50,
      crossed200: mas.cross200,
      higherLow: false,
    },
    DEFAULT_SETTINGS.recovery_weights,
  );
  const mom = momentumScore({
    d1: returns.d1,
    d5: returns.d5,
    d20: returns.d20,
    d50: returns.d50,
    d200: returns.d200,
    trendState: mas.trendState,
  });
  const fundOk = !extras?.fundamentalAvailableAt || extras.fundamentalAvailableAt <= asOf;
  const values: Record<FeatureKey, number | null> = {
    return_1m: returns.m1,
    return_3m: returns.m3,
    return_6m: returns.m6,
    return_1y: returns.y1,
    drawdown: dd?.distanceFromAthPercent ?? null,
    price_vs_50: mas.priceVs50,
    price_vs_200: mas.priceVs200,
    rsi: rsi(closes),
    rs_1y: rsScore(returns.y1, extras?.sectorReturn1y ?? null),
    volatility_20: vol20,
    volume_ratio: lastVol != null && avgVol > 0 ? lastVol / avgVol : null,
    recovery_score: rec,
    momentum_score: mom,
    sector_return_1y: extras?.sectorReturn1y ?? null,
    regime_score: extras?.regimeScore ?? null,
    quality: fundOk ? extras?.quality ?? null : null,
    valuation: fundOk ? extras?.valuation ?? null : null,
    earnings: fundOk ? extras?.earnings ?? null : null,
    pe: fundOk ? extras?.pe ?? null : null,
    pb: fundOk ? extras?.pb ?? null : null,
    roe: fundOk ? extras?.roe ?? null : null,
    roce: fundOk ? extras?.roce ?? null : null,
  };
  const sources: Record<string, string> = {};
  for (const k of FEATURE_KEYS) {
    sources[k] = values[k] == null ? "unavailable" : k.startsWith("pe") || k === "roe" || k === "roce" || k === "pb" || k === "quality" || k === "valuation" || k === "earnings"
      ? "licensed_fundamental_or_null"
      : "official_price";
  }
  return {
    asOf: last.date,
    availableAt: last.date,
    version: FEATURE_SET_VERSION,
    values,
    sources,
  };
}

export { FEATURE_KEYS };
