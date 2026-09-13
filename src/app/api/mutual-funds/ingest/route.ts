import { runMfIngestion } from "@/services/mf-ingestion";
import { env } from "@/lib/env";
import { fail, ok } from "../../_util";

export async function POST(req: Request) {
  if (env().ADMIN_PASSWORD) {
    const pass = req.headers.get("x-admin-password");
    if (pass !== env().ADMIN_PASSWORD) return fail("Unauthorized", 401);
  }
  const body = (await req.json().catch(() => ({}))) as { mode?: "daily" | "backfill" | "manual" };
  return ok(await runMfIngestion(body.mode ?? "daily"));
}
