import type { PriceBar } from "./trading-days";

export type AthResult = {
  closingAth: number;
  closingAthDate: string;
  intradayAth: number | null;
  intradayAthDate: string | null;
};

/**
 * ATH is the maximum historical value available as of the last bar.
 * Never uses future observations. Does not fabricate missing history.
 */
export function calculateAth(barsThroughDate: PriceBar[]): AthResult | null {
  if (!barsThroughDate.length) return null;

  let closingAth = -Infinity;
  let closingAthDate = barsThroughDate[0].date;
  let intradayAth = -Infinity;
  let intradayAthDate: string | null = null;
  let hasIntraday = false;

  for (const bar of barsThroughDate) {
    if (Number.isFinite(bar.close) && bar.close >= closingAth) {
      closingAth = bar.close;
      closingAthDate = bar.date;
    }
    if (bar.high != null && Number.isFinite(bar.high)) {
      hasIntraday = true;
      if (bar.high >= intradayAth) {
        intradayAth = bar.high;
        intradayAthDate = bar.date;
      }
    }
  }

  if (!Number.isFinite(closingAth)) return null;

  return {
    closingAth,
    closingAthDate,
    intradayAth: hasIntraday ? intradayAth : null,
    intradayAthDate: hasIntraday ? intradayAthDate : null,
  };
}

export function pickAth(
  ath: AthResult,
  methodology: "closing" | "intraday" = "closing",
): { value: number; date: string } {
  if (methodology === "intraday" && ath.intradayAth != null && ath.intradayAthDate) {
    return { value: ath.intradayAth, date: ath.intradayAthDate };
  }
  return { value: ath.closingAth, date: ath.closingAthDate };
}
