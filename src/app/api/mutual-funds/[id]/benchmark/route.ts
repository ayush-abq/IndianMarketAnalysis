import { getDb } from "@/db/client";
import { mutualFundBenchmarks } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { ok } from "../../../_util";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const rows = await db
    .select()
    .from(mutualFundBenchmarks)
    .where(eq(mutualFundBenchmarks.fundId, Number(id)))
    .orderBy(desc(mutualFundBenchmarks.date))
    .limit(12);
  return ok(rows);
}
