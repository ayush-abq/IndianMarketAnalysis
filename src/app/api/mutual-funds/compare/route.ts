import { compareFunds, overlapForFunds } from "@/services/mf-queries";
import { fail, ok } from "../../_util";

export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .slice(0, 5);
  if (ids.length < 2) return fail("Provide at least two ids");
  const funds = await compareFunds(ids);
  const overlap = await overlapForFunds(ids);
  return ok({ funds, overlap });
}
