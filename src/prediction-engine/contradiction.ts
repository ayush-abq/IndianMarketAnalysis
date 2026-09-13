export type Conflict = { field: string; stance: "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN"; detail: string };

export function detectConflicts(input: {
  valuation?: number | null;
  earnings?: number | null;
  return1m?: number | null;
  sectorReturn1y?: number | null;
  rs1y?: number | null;
  flow?: number | null;
}) {
  const items: Conflict[] = [];
  const stance = (v: number | null | undefined, bull: number, bear: number, field: string, detail: string): Conflict => {
    if (v == null) return { field, stance: "UNKNOWN", detail: `${field} unavailable` };
    if (v >= bull) return { field, stance: "BULLISH", detail };
    if (v <= bear) return { field, stance: "BEARISH", detail };
    return { field, stance: "NEUTRAL", detail };
  };
  items.push(stance(input.valuation, 60, 40, "valuation", "Valuation score"));
  items.push(stance(input.earnings, 60, 40, "earnings", "Earnings score"));
  items.push(stance(input.return1m, 2, -2, "price", "1-month return"));
  items.push(stance(input.sectorReturn1y, 5, -5, "sector", "Sector 1Y"));
  items.push(stance(input.rs1y, 5, -5, "relative_strength", "RS vs sector/Nifty"));
  items.push(stance(input.flow, 0.1, -0.1, "institutional_flow", "Institutional flow"));
  const known = items.filter((i) => i.stance !== "UNKNOWN");
  const bulls = known.filter((i) => i.stance === "BULLISH").length;
  const bears = known.filter((i) => i.stance === "BEARISH").length;
  const conflict = bulls > 0 && bears > 0;
  return {
    items,
    conflict,
    label: conflict ? "SIGNAL CONFLICT" : known.length < 2 ? "INSUFFICIENT EVIDENCE" : "ALIGNED",
    note: conflict
      ? "Do not emit an overly confident final score while evidence conflicts."
      : "Stances use stored metrics only. Unknown fields stay unknown.",
  };
}
