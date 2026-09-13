import { acknowledgeAlert, listAlerts } from "@/services/alerts";
import { fail, ok } from "../_util";

export async function GET() {
  return ok(await listAlerts());
}

export async function POST(req: Request) {
  const body = (await req.json()) as { id?: number };
  if (!body.id) return fail("id required");
  await acknowledgeAlert(body.id);
  return ok({ ok: true });
}
