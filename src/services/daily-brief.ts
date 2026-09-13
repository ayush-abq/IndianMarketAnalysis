import { getDb } from "@/db/client";
import { dailyBriefs } from "@/db/schema";
import { buildDashboard, loadScannerRows } from "@/services/queries";
import { latestMarketContext } from "@/services/market-context";
import { buildOpportunityRadar } from "@/services/opportunity-radar";
import { loadFundRows } from "@/services/mf-queries";
import { MODEL_VERSIONS } from "@/config/terminal-defaults";

export async function generateIntelligenceBrief(asOf: string, kind: "daily" | "weekly" | "monthly" = "daily") {
  const dash = await buildDashboard("PR");
  const regime = await latestMarketContext();
  const radar = await buildOpportunityRadar();
  const funds = await loadFundRows({ plan: "DIRECT", option: "GROWTH" }).catch(() => []);
  const sectors = await loadScannerRows({ asOf, returnType: "PR" });
  const winners = [...sectors].filter((s) => s.return1d != null).sort((a, b) => (b.return1d ?? 0) - (a.return1d ?? 0)).slice(0, 5);
  const losers = [...sectors].filter((s) => s.return1d != null).sort((a, b) => (a.return1d ?? 0) - (b.return1d ?? 0)).slice(0, 5);

  const title =
    kind === "daily"
      ? `India Market Daily Brief — ${asOf}`
      : kind === "weekly"
        ? `Weekly Market Intelligence Report — ${asOf}`
        : `Monthly Intelligence Review — ${asOf}`;

  const body = {
    disclaimer:
      "Research summary from local precomputed data. Not a forecast and not a recommendation to buy or sell.",
    modelVersion: MODEL_VERSIONS.opportunity,
    whatIsHappening: {
      regime: regime && "regime" in regime ? regime.regime : dash.regime,
      score: regime && "score" in regime ? Number(regime.score) : null,
      nifty50: dash.lists.beatenDown[0] ? undefined : undefined,
      explanation: regime && "explanation" in regime ? regime.explanation : null,
    },
    whereIsTheStress: {
      below30: dash.totals.below30,
      below40: dash.totals.below40,
      below50: dash.totals.below50,
      extreme: dash.lists.extreme.slice(0, 5).map((r) => ({ name: r.name, drawdown: r.distanceFromAth })),
    },
    whereIsRecoveryStarting: radar.lists.earlyRecovery.slice(0, 8),
    whereAreFundamentalsImproving: radar.lists.earningsAcceleration.slice(0, 8),
    whereIsValue: radar.lists.qualityValue.slice(0, 8),
    whatIsDeteriorating: radar.lists.deteriorating.slice(0, 8),
    whatShouldIResearch: radar.lists.topSectors.slice(0, 5),
    sectorWinners: winners.map((r) => ({ name: r.name, return1d: r.return1d })),
    sectorLosers: losers.map((r) => ({ name: r.name, return1d: r.return1d })),
    fundSnapshot: {
      scored: funds.length,
      top: funds.slice(0, 5).map((f) => ({ name: f.schemeName, score: f.overallScore, cagr5y: f.cagr5y })),
    },
    radarLists: {
      qualityValue: names(radar.lists.qualityValue),
      earlyRecovery: names(radar.lists.earlyRecovery),
      beatenDown: names(radar.lists.beatenDown),
      fallingKnives: names(radar.lists.fallingKnives),
      valueTraps: names(radar.lists.valueTraps),
    },
  };

  const db = getDb();
  await db
    .insert(dailyBriefs)
    .values({ date: asOf, kind, title, body })
    .onConflictDoUpdate({
      target: [dailyBriefs.date, dailyBriefs.kind],
      set: { title, body },
    });
  return { title, body };
}

function names(items: { name: string }[]) {
  return items.slice(0, 10).map((i) => i.name);
}

export async function latestBrief(kind: "daily" | "weekly" | "monthly" = "daily") {
  const db = getDb();
  const { desc, eq } = await import("drizzle-orm");
  const row = (
    await db.select().from(dailyBriefs).where(eq(dailyBriefs.kind, kind)).orderBy(desc(dailyBriefs.date)).limit(1)
  )[0];
  return row ?? null;
}
