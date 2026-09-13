import { whatChangedToday } from "@/services/changes";
import { ok } from "../_util";

export async function GET(req: Request) {
  const asOf = new URL(req.url).searchParams.get("asOf") ?? undefined;
  return ok(await whatChangedToday(asOf));
}
