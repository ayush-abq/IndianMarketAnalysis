import type { PriceBar } from "@/calculations/trading-days";

export type QualityFlag = {
  indexId: number | null;
  date: string | null;
  flag: string;
  message: string;
};

export function validateBars(indexId: number, bars: PriceBar[]): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const seen = new Set<string>();
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));

  for (const bar of sorted) {
    if (seen.has(bar.date)) {
      flags.push({
        indexId,
        date: bar.date,
        flag: "DUPLICATE",
        message: `Duplicate bar for ${bar.date}`,
      });
    }
    seen.add(bar.date);

    if (!Number.isFinite(bar.close)) {
      flags.push({
        indexId,
        date: bar.date,
        flag: "NULL_VALUE",
        message: `Invalid close on ${bar.date}`,
      });
      continue;
    }

    const { open, high, low, close } = bar;
    if (open != null && high != null && low != null) {
      if (high < low || high < close || low > close || high < open || low > open) {
        flags.push({
          indexId,
          date: bar.date,
          flag: "INVALID_OHLC",
          message: `OHLC relationship invalid on ${bar.date}`,
        });
      }
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].close;
    const cur = sorted[i].close;
    if (prev > 0 && Number.isFinite(cur)) {
      const jump = Math.abs(cur / prev - 1);
      if (jump >= 0.35) {
        flags.push({
          indexId,
          date: sorted[i].date,
          flag: "ABNORMAL_JUMP",
          message: `Close jumped ${(jump * 100).toFixed(1)}% on ${sorted[i].date}`,
        });
      }
    }
  }

  return flags;
}

export function detectMissingDates(
  indexId: number,
  dates: string[],
  tradingDays: string[],
): QualityFlag[] {
  const have = new Set(dates);
  return tradingDays
    .filter((d) => !have.has(d))
    .map((d) => ({
      indexId,
      date: d,
      flag: "MISSING_DATE",
      message: `Missing trading date ${d}`,
    }));
}

export function detectStale(latestDate: string | null, expectedDate: string): QualityFlag[] {
  if (!latestDate) {
    return [{ indexId: null, date: null, flag: "DATA_WARNING", message: "No price history available" }];
  }
  if (latestDate < expectedDate) {
    return [
      {
        indexId: null,
        date: latestDate,
        flag: "STALE",
        message: `Data through ${latestDate}; expected ${expectedDate}`,
      },
    ];
  }
  return [];
}
