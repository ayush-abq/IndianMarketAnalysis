import { computeSipOnDemand } from "@/services/mf-queries";
import { parseNum, fail, ok } from "../../../_util";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const amount = parseNum(url.searchParams.get("amount")) ?? 10000;
  const frequency = url.searchParams.get("frequency") === "quarterly" ? "quarterly" : "monthly";
  const sip = await computeSipOnDemand(Number(id), amount, frequency);
  if (!sip) return fail("Insufficient NAV history", 404);
  return ok({ amount, frequency, ...sip });
}
