import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { indices } from "@/db/schema";
import { ok } from "../_util";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(indices).where(eq(indices.active, true));
  return ok(rows);
}
