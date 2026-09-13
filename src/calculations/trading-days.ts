export type PriceBar = {
  date: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close: number;
  volume?: number | null;
};

export function sortBars(bars: PriceBar[]): PriceBar[] {
  return [...bars].sort((a, b) => a.date.localeCompare(b.date));
}

export function toDateOnly(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function isWeekend(date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

export function isTradingDay(date: string, holidays: Set<string>): boolean {
  return !isWeekend(date) && !holidays.has(date);
}

export function addCalendarDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Closest prior trading observation at least `tradingDays` bars before the
 * as-of bar. Uses the series itself (true trading-day count), not calendar days.
 */
export function barNTradingDaysAgo(
  sorted: PriceBar[],
  asOfIndex: number,
  tradingDays: number,
): PriceBar | null {
  const target = asOfIndex - tradingDays;
  if (target < 0) return null;
  return sorted[target] ?? null;
}

export function findAsOfIndex(sorted: PriceBar[], asOfDate: string): number {
  let lo = 0;
  let hi = sorted.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cmp = sorted[mid].date.localeCompare(asOfDate);
    if (cmp <= 0) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function sliceThrough(sorted: PriceBar[], asOfDate: string): PriceBar[] {
  const idx = findAsOfIndex(sorted, asOfDate);
  if (idx < 0) return [];
  return sorted.slice(0, idx + 1);
}

export function lastBar(sorted: PriceBar[]): PriceBar | null {
  return sorted.length ? sorted[sorted.length - 1] : null;
}
