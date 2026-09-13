import { generateIntelligenceBrief, latestBrief } from "@/services/daily-brief";
import { latestMetricDate } from "@/services/queries";
import { ok } from "../_util";

export async function GET(req: Request) {
  const kind = (new URL(req.url).searchParams.get("kind") ?? "daily") as "daily" | "weekly" | "monthly";
  return ok({ brief: await latestBrief(kind) });
}

export async function POST(req: Request) {
  const kind = (new URL(req.url).searchParams.get("kind") ?? "daily") as "daily" | "weekly" | "monthly";
  const asOf = (await latestMetricDate("PR")) ?? new Date().toISOString().slice(0, 10);
  return ok(await generateIntelligenceBrief(asOf, kind));
}
