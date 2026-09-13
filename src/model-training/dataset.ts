import { labeledForward, sampleAsOfDates } from "@/services/strategy-lab";
import { featuresFromBars } from "@/feature-store/features";
import type { LabeledRow } from "@/ml/types";
import type { PriceBar } from "@/calculations/trading-days";

const HORIZONS = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252 } as const;

export function buildLabeledRows(
  entity: { id: number; name: string },
  bars: PriceBar[],
  opts?: { from?: string; to?: string; every?: number; extras?: Parameters<typeof featuresFromBars>[2] },
): LabeledRow[] {
  if (bars.length < 80) return [];
  const from = opts?.from ?? bars[0].date;
  const to = opts?.to ?? bars[bars.length - 1].date;
  const dates = sampleAsOfDates(bars, from, to, opts?.every ?? 21);
  const out: LabeledRow[] = [];
  for (const asOf of dates) {
    const feat = featuresFromBars(bars, asOf, opts?.extras);
    if (!feat) continue;
    for (const [horizon, days] of Object.entries(HORIZONS) as [LabeledRow["horizon"], number][]) {
      const fwd = labeledForward(bars, asOf, days);
      const path = pathDrawdown(bars, asOf, days);
      out.push({
        entityId: entity.id,
        entityName: entity.name,
        asOf,
        features: feat.values,
        horizon,
        labelReturn: fwd,
        labelPositive: fwd == null ? null : fwd > 0 ? 1 : 0,
        labelGain10: fwd == null ? null : fwd > 10 ? 1 : 0,
        labelGain20: fwd == null ? null : fwd > 20 ? 1 : 0,
        labelGain30: fwd == null ? null : fwd > 30 ? 1 : 0,
        labelDd20: path == null ? null : path >= 20 ? 1 : 0,
      });
    }
  }
  return out;
}

function pathDrawdown(bars: PriceBar[], asOf: string, hold: number) {
  const idx = bars.findIndex((b) => b.date >= asOf);
  if (idx < 0 || idx + hold >= bars.length) return null;
  const start = bars[idx].close;
  let peak = start;
  let maxDd = 0;
  for (let i = idx; i <= idx + hold; i++) {
    peak = Math.max(peak, bars[i].close);
    maxDd = Math.max(maxDd, peak > 0 ? ((peak - bars[i].close) / peak) * 100 : 0);
  }
  return maxDd;
}

export function filterHorizon(rows: LabeledRow[], horizon: LabeledRow["horizon"], label: keyof LabeledRow) {
  return rows.filter((r) => r.horizon === horizon && r[label] != null);
}
