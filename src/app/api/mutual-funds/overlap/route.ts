import { overlapForFunds } from "@/services/mf-queries";
import { builtPortfolio } from "@/services/mf-research";
import { fail, ok } from "../../_util";

export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter(Number.isFinite);
  if (ids.length < 2) return fail("Need at least two fund ids");
  return ok(await overlapForFunds(ids));
}

export async function POST(req: Request) {
  const body = (await req.json()) as { legs?: { id: number; weight: number }[] };
  if (!body.legs?.length) return fail("legs required");
  return ok(await builtPortfolio(body.legs));
}
