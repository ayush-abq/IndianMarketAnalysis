import { describe, expect, it } from "vitest";
import { blendModelChances, rsiStance, technicalOverview } from "@/scoring/technical-stance";

describe("Groww-style technical overview", () => {
  it("marks RSI overbought as bearish and oversold as bullish", () => {
    expect(rsiStance(78).verdict).toBe("BEARISH");
    expect(rsiStance(22).verdict).toBe("BULLISH");
    expect(rsiStance(51).verdict).toBe("NEUTRAL");
  });

  it("votes bullish when price is above both averages and returns are up", () => {
    const t = technicalOverview({
      rsi: 58,
      priceVs50: 3,
      priceVs200: 8,
      return1m: 4,
      return3m: 6,
      trendState: "UPTREND",
    });
    expect(t.overall).toBe("BULLISH");
    expect(t.probabilities.bullish + t.probabilities.neutral + t.probabilities.bearish).toBe(100);
    expect(t.probabilities.bullish).toBeGreaterThan(t.probabilities.bearish);
  });

  it("does not invent a third model class — leftover is sideways", () => {
    const m = blendModelChances({ rise: 0.66, fall20: 0.24 });
    expect(m.bullish).toBe(66);
    expect(m.bearish).toBe(24);
    expect(m.neutral).toBe(10);
  });
});
