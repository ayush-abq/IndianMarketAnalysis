import { latestMarketContext, snapshotMarketContext } from "@/services/market-context";
import { buildDashboard } from "@/services/queries";
import { ok } from "../_util";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("refresh") === "1") await snapshotMarketContext();
  const [ctx, dash] = await Promise.all([latestMarketContext(), buildDashboard("PR")]);
  return ok({
    context: ctx,
    dashboard: dash,
    disclaimer: "Market regime is research context, not a trading signal.",
  });
}
