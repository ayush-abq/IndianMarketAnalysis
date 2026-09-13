import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { alerts, dailySnapshots, indices } from "@/db/schema";
import { getSettings } from "@/services/settings";
import { loadScannerRows } from "@/services/queries";
import { logger } from "@/lib/logger";
import { formatPct } from "@/lib/utils";

type Snap = {
  name: string;
  distanceFromAth: number;
  return1y: number | null;
  return2y: number | null;
  return5y: number | null;
  recoveryScore: number;
  signal: string;
  priceVs50: number | null;
  priceVs200: number | null;
};

export async function generateDailyAlerts(asOf: string) {
  const db = getDb();
  const settings = await getSettings();
  const today = await loadScannerRows({ asOf, returnType: "PR", includeBenchmarks: true });
  const previous = await previousSnapshots(asOf);
  const prevByName = new Map(previous.map((p) => [p.name, p]));

  const created: string[] = [];
  const add = async (
    indexId: number | null,
    type: string,
    severity: string,
    message: string,
  ) => {
    await db.insert(alerts).values({
      indexId,
      date: asOf,
      alertType: type,
      severity,
      message,
    });
    created.push(message);
  };

  for (const row of today) {
    const prev = prevByName.get(row.name);
    const idx = row.indexId;

    for (const th of settings.alert_thresholds.drawdown_crosses) {
      if (row.distanceFromAth >= th && (prev?.distanceFromAth ?? th - 1) < th) {
        await add(
          idx,
          `CROSSED_${th}`,
          th >= 50 ? "high" : "medium",
          `${row.name} is now ${row.distanceFromAth.toFixed(1)}% below its historical closing ATH.`,
        );
      }
    }

    if ((row.return1y ?? 1) < 0 && (prev?.return1y == null || prev.return1y >= 0)) {
      await add(idx, "NEG_1Y", "medium", `${row.name} 1Y return turned negative at ${formatPct(row.return1y)}.`);
    }
    if ((row.return2y ?? 1) < 0 && (prev?.return2y == null || prev.return2y >= 0)) {
      await add(idx, "NEG_2Y", "medium", `${row.name} 2Y return turned negative at ${formatPct(row.return2y)}.`);
    }
    if ((row.return5y ?? 1) < 0 && (prev?.return5y == null || prev.return5y >= 0)) {
      await add(idx, "NEG_5Y", "high", `${row.name} 5Y return turned negative at ${formatPct(row.return5y)}.`);
    }

    if (prev && row.recoveryScore - prev.recoveryScore >= settings.alert_thresholds.recovery_delta) {
      await add(
        idx,
        "RECOVERY_UP",
        "info",
        `${row.name} recovery score improved ${prev.recoveryScore.toFixed(0)} → ${row.recoveryScore.toFixed(0)}.`,
      );
    }
    if (prev && prev.recoveryScore - row.recoveryScore >= settings.alert_thresholds.recovery_delta) {
      await add(
        idx,
        "RECOVERY_DOWN",
        "medium",
        `${row.name} recovery score deteriorated ${prev.recoveryScore.toFixed(0)} → ${row.recoveryScore.toFixed(0)}.`,
      );
    }

    if (row.signal === "FALLING_KNIFE" && prev?.signal !== "FALLING_KNIFE") {
      await add(idx, "FALLING_KNIFE", "high", `${row.name} is deeply beaten down but still falling.`);
    }
    if (row.signal === "EARLY_RECOVERY" && prev?.signal !== "EARLY_RECOVERY") {
      await add(idx, "EARLY_RECOVERY", "info", `${row.name} moved into an early recovery candidate profile.`);
    }
    if (prev?.signal === "FALLING_KNIFE" && row.signal === "EARLY_RECOVERY") {
      await add(idx, "SIGNAL_FLIP", "info", `${row.name} moved from Falling Knife to Early Recovery.`);
    }
    if ((row.priceVs50 ?? -1) > 0 && (prev?.priceVs50 ?? 1) <= 0) {
      await add(idx, "CROSS_50", "info", `${row.name} crossed above its 50DMA.`);
    }
    if ((row.priceVs200 ?? -1) > 0 && (prev?.priceVs200 ?? 1) <= 0) {
      await add(idx, "CROSS_200", "info", `${row.name} crossed above its 200DMA.`);
    }
  }

  logger.info({ asOf, alerts: created.length }, "Daily alerts generated from snapshot comparison");
  return created;
}

async function previousSnapshots(asOf: string): Promise<Snap[]> {
  const db = getDb();
  const rows = await db
    .select({
      date: dailySnapshots.date,
      payload: dailySnapshots.payload,
      name: indices.name,
    })
    .from(dailySnapshots)
    .innerJoin(indices, eq(dailySnapshots.indexId, indices.id))
    .where(eq(dailySnapshots.returnType, "PR"))
    .orderBy(desc(dailySnapshots.date));
  const priorDate = rows.find((r) => r.date < asOf)?.date;
  if (!priorDate) return [];
  return rows
    .filter((r) => r.date === priorDate)
    .map((r) => {
      const p = r.payload as Snap;
      return { ...p, name: r.name };
    });
}

export async function listAlerts(limit = 200) {
  const db = getDb();
  return db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(limit);
}

export async function acknowledgeAlert(id: number) {
  const db = getDb();
  await db.update(alerts).set({ acknowledged: true }).where(eq(alerts.id, id));
}
