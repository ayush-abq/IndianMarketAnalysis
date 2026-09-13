import { sipGoalScenarios } from "@/services/mf-research";
import { parseNum, ok } from "../../_util";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const monthly = parseNum(url.searchParams.get("monthly")) ?? 10000;
  const years = parseNum(url.searchParams.get("years")) ?? 10;
  return ok(sipGoalScenarios(monthly, years));
}
