import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { indexDrawdowns } from "@/db/schema";
import { fail, ok } from "../../../_util";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const [row] = await db
    .select()
    .from(indexDrawdowns)
    .where(and(eq(indexDrawdowns.indexId, Number(id)), eq(indexDrawdowns.returnType, "PR")))
    .orderBy(desc(indexDrawdowns.date))
    .limit(1);
  if (!row) return fail("Not found", 404);
  return ok(row);
}
