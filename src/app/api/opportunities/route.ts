import { buildOpportunityRadar } from "@/services/opportunity-radar";
import { ok } from "../_util";
import type { ResearchMode } from "@/config/alpha-defaults";

/** Alias of the radar with explicit research-mode + confluence fields. */
export async function GET(req: Request) {
  const mode = (new URL(req.url).searchParams.get("mode") ?? "BALANCED").toUpperCase() as ResearchMode;
  const allowed: ResearchMode[] = ["CONSERVATIVE", "BALANCED", "AGGRESSIVE"];
  return ok(await buildOpportunityRadar(allowed.includes(mode) ? mode : "BALANCED"));
}
