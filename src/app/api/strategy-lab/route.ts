import { runStrategyLab, type ScreenConditions } from "@/services/strategy-lab";
import { fail, ok, parseNum } from "../_util";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const from = String(body.from ?? "");
  const to = String(body.to ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return fail("from and to (YYYY-MM-DD) are required");
  }
  const conditions: ScreenConditions = {
    minDrawdown: num(body.minDrawdown),
    maxDrawdown: num(body.maxDrawdown),
    minQuality: num(body.minQuality),
    minValuation: num(body.minValuation),
    minRecovery: num(body.minRecovery),
    minEarnings: num(body.minEarnings),
    minRs: num(body.minRs),
    minOpportunity: num(body.minOpportunity),
    excludeFallingKnife: Boolean(body.excludeFallingKnife),
  };
  const result = await runStrategyLab({
    name: typeof body.name === "string" ? body.name : "Strategy Lab",
    universe: body.universe === "STOCK" ? "STOCK" : "SECTOR",
    conditions,
    holdTradingDays: num(body.holdTradingDays) ?? 252,
    from,
    to,
    sampleEvery: num(body.sampleEvery) ?? 21,
    persist: body.persist === true,
    execution: body.execution === "SAME_CLOSE" ? "SAME_CLOSE" : "NEXT_SESSION",
    costScenario: body.costScenario === "low" || body.costScenario === "high" ? body.costScenario : "base",
  });
  return ok(result);
}

function num(v: unknown) {
  if (v == null || v === "") return undefined;
  return parseNum(String(v));
}
