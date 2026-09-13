import { ingestControlStatus, startIngestFromUi, type IngestKind } from "@/services/ingest-control";
import { env } from "@/lib/env";
import { fail, ok } from "../_util";

export async function GET() {
  return ok(await ingestControlStatus());
}

export async function POST(req: Request) {
  if (env().ADMIN_PASSWORD) {
    const pass = req.headers.get("x-admin-password");
    if (pass !== env().ADMIN_PASSWORD) return fail("Unauthorized", 401);
  }
  const body = (await req.json().catch(() => ({}))) as { kind?: IngestKind };
  const kind = body.kind === "history" ? "history" : "today";
  const status = await ingestControlStatus();
  if (status.busy && !status.job) {
    return ok({
      accepted: false,
      reason: "A load is already running (this page or a terminal job). Wait until it finishes — stored days are kept.",
      ...status,
    });
  }
  const started = startIngestFromUi(kind);
  return ok({ ...started, ...(await ingestControlStatus()) });
}
