import { getSettings, saveSettings } from "@/services/settings";
import { env } from "@/lib/env";
import { fail, ok } from "../_util";

export async function GET() {
  return ok({
    settings: await getSettings(),
    provider: env().DATA_PROVIDER,
    fallback: env().FALLBACK_PROVIDER,
  });
}

export async function PUT(req: Request) {
  if (env().ADMIN_PASSWORD) {
    const user = req.headers.get("x-admin-user");
    const pass = req.headers.get("x-admin-password");
    if (user !== env().ADMIN_USER || pass !== env().ADMIN_PASSWORD) {
      return fail("Unauthorized", 401);
    }
  }
  const body = await req.json();
  return ok(await saveSettings(body));
}
