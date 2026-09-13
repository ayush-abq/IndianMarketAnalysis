import { buildDashboard, loadScannerRows } from "@/services/queries";
import { loadHolidaySet } from "@/services/calendar";
import { logger } from "@/lib/logger";
import { formatPct } from "@/lib/utils";
import { getDb } from "@/db/client";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function generateDailyReport(asOf: string) {
  const dash = await buildDashboard("PR");
  const rows = await loadScannerRows({ asOf, returnType: "PR" });
  const holidays = await loadHolidaySet();

  const section = (title: string, list: typeof rows, fmt: (r: (typeof rows)[0]) => string) =>
    [`## ${title}`, ...list.slice(0, 10).map(fmt), ""].join("\n");

  const text = [
    `# NSE Sector Stress Report — ${asOf}`,
    "",
    "## Market overview",
    `Regime: ${dash.regime ?? "n/a"}`,
    `Indices tracked: ${dash.totals.indices}`,
    `>30% below ATH: ${dash.totals.below30} | >40%: ${dash.totals.below40} | >50%: ${dash.totals.below50}`,
    `Negative 1Y / 2Y / 5Y: ${dash.totals.neg1y} / ${dash.totals.neg2y} / ${dash.totals.neg5y}`,
    `Early recovery / falling knives / structural: ${dash.totals.recoveryCandidates} / ${dash.totals.fallingKnives} / ${dash.totals.structural}`,
    `Data through: ${dash.dataThrough ?? "n/a"} | Stale: ${dash.stale ? "YES" : "no"}`,
    "",
    section("Most beaten-down sectors", dash.lists.beatenDown, (r) => `- ${r.name}: ${r.distanceFromAth.toFixed(1)}% below ATH, 1Y ${formatPct(r.return1y)}, signal ${r.signalLabel}`),
    section("Worst 1Y performers", dash.lists.worst1y, (r) => `- ${r.name}: ${formatPct(r.return1y)}`),
    section("Worst 2Y performers", dash.lists.worst2y, (r) => `- ${r.name}: ${formatPct(r.return2y)}`),
    section("Worst 5Y performers", dash.lists.worst5y, (r) => `- ${r.name}: ${formatPct(r.return5y)}`),
    section("Extreme drawdowns", dash.lists.extreme, (r) => `- ${r.name}: ${r.distanceFromAth.toFixed(1)}% below ATH`),
    section("Possible capitulation", rows.filter((r) => r.signal === "POSSIBLE_CAPITULATION"), (r) => `- ${r.name}: ${r.distanceFromAth.toFixed(1)}% / 1Y ${formatPct(r.return1y)}`),
    section("Falling knives", dash.lists.fallingKnives, (r) => `- ${r.name}: still falling, recovery ${r.recoveryScore.toFixed(0)}`),
    section("Early recovery candidates", dash.lists.recoveries, (r) => `- ${r.name}: recovery ${r.recoveryScore.toFixed(0)}, 3M ${formatPct(r.return3m)}`),
    "## Data quality status",
    `Holiday calendar entries: ${holidays.size}`,
    `Provider: ${dash.provider}`,
    "",
    "This report is research context, not investment advice.",
  ].join("\n");

  const db = getDb();
  await db
    .insert(appSettings)
    .values({ key: `report:${asOf}`, value: { asOf, text, generatedAt: new Date().toISOString() } })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: { asOf, text, generatedAt: new Date().toISOString() }, updatedAt: new Date() },
    });
  logger.info({ asOf }, "Daily report stored");
  return text;
}

export async function getDailyReport(asOf?: string) {
  const db = getDb();
  if (asOf) {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, `report:${asOf}`));
    return rows[0]?.value ?? null;
  }
  const rows = await db.select().from(appSettings);
  const reports = rows.filter((r) => r.key.startsWith("report:")).sort((a, b) => b.key.localeCompare(a.key));
  return reports[0]?.value ?? null;
}
