import { calibrateScreen, fillSignalForwards } from "@/services/signal-tracker";
import { ok } from "../_util";

export async function GET(req: Request) {
  const screen = new URL(req.url).searchParams.get("screen") ?? "EARLY_RECOVERY";
  return ok(await calibrateScreen(screen));
}

export async function POST() {
  return ok(await fillSignalForwards());
}
