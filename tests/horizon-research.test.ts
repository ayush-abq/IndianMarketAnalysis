import { describe, expect, it } from "vitest";
import {
  isBlockedLabel,
  isCashLikeFund,
  isPlausibleLookback,
  pickHorizonValue,
  rankHorizonRows,
  scenarioFromRegime,
  type HorizonRow,
} from "@/services/horizon-research";

function row(over: Partial<HorizonRow> = {}): HorizonRow {
  return {
    type: "STOCK",
    id: 1,
    name: "A",
    href: "/stocks/1",
    horizonReturn: 12,
    stance: "BULLISH",
    technical: null,
    classification: "IMPROVING",
    drawdown: 8,
    vs200: 3,
    why: "tape",
    ...over,
  };
}

describe("horizon research", () => {
  it("does not invent a missing window", () => {
    expect(pickHorizonValue({ "1M": 4, "3M": null, "6M": null, "1Y": 10, "3Y": null, "5Y": null, "10Y": null }, "6M")).toBeNull();
    expect(pickHorizonValue({ "1M": 4, "3M": null, "6M": null, "1Y": 10, "3Y": null, "5Y": null, "10Y": null }, "1Y")).toBe(10);
  });

  it("drops falling knives and non-positive lookbacks", () => {
    const ranked = rankHorizonRows(
      [
        row({ id: 1, name: "Knife", classification: "FALLING_KNIFE", horizonReturn: 40 }),
        row({ id: 2, name: "Loser", horizonReturn: -3 }),
        row({ id: 3, name: "Winner", horizonReturn: 18 }),
        row({ id: 4, name: "Missing", horizonReturn: null }),
        row({ id: 5, type: "FUND", name: "Nippon Overnight Fund", horizonReturn: 8 }),
        row({ id: 6, type: "STOCK", name: "Listing spike", horizonReturn: 230 }),
      ],
      "1M",
    );
    expect(ranked.map((r) => r.name)).toEqual(["Winner"]);
  });

  it("does not turn a bear tape into a buy list", () => {
    const s = scenarioFromRegime("BEAR", 20);
    expect(s.title).toMatch(/Bear/i);
    expect(s.caution.toLowerCase()).not.toMatch(/buy/);
    expect(isBlockedLabel("FALLING_KNIFE")).toBe(true);
    expect(isCashLikeFund("ICICI Prudential Overnight Fund")).toBe(true);
    expect(isPlausibleLookback("FUND", "1M", 298)).toBe(false);
  });
});
