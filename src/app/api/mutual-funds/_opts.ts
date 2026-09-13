import { parseNum } from "../_util";

export function listOpts(url: URL) {
  return {
    plan: url.searchParams.get("plan") ?? "DIRECT",
    option: url.searchParams.get("option") ?? "GROWTH",
    assetClass: url.searchParams.get("assetClass") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    signal: url.searchParams.get("signal") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    amc: url.searchParams.get("amc") ?? undefined,
    indexOnly: url.searchParams.get("indexOnly") === "1",
    minScore: parseNum(url.searchParams.get("minScore")),
    horizon: url.searchParams.get("horizon") ?? undefined,
    riskProfile: url.searchParams.get("risk") ?? undefined,
    asOf: url.searchParams.get("asOf") ?? undefined,
    limit: parseNum(url.searchParams.get("limit")) ?? 50,
  };
}
