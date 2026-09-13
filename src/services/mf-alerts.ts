import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { alerts, mutualFundScores, mutualFunds } from "@/db/schema";
import { logger } from "@/lib/logger";
import { loadFundRows } from "@/services/mf-queries";

export async function generateMfAlerts(asOf: string) {
  const db = getDb();
  const rows = await loadFundRows({ plan: "DIRECT", option: "GROWTH" });
  if (!rows.length) return { created: 0 };

  const prevDate = await previousScoreDate(asOf);
  const prevTop = new Set<number>();
  if (prevDate) {
    const prev = await db
      .select({ fundId: mutualFundScores.fundId, overall: mutualFundScores.overallScore })
      .from(mutualFundScores)
      .where(eq(mutualFundScores.date, prevDate));
    prev
      .sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0))
      .slice(0, 10)
      .forEach((r) => prevTop.add(r.fundId));
  }

  const todayTop = rows.slice(0, 10).map((r) => r.id);
  const created: string[] = [];
  const add = async (type: string, severity: string, message: string) => {
    await db.insert(alerts).values({
      indexId: null,
      date: asOf,
      alertType: type,
      severity,
      message,
    });
    created.push(message);
  };

  for (const row of rows.slice(0, 10)) {
    if (!prevTop.has(row.id)) {
      await add(
        "MF_ENTERED_TOP_10",
        "info",
        `${row.schemeName} entered the Direct Growth research top 10 (score ${row.overallScore?.toFixed(1) ?? "n/a"}). Research classification only.`,
      );
    }
  }
  for (const id of prevTop) {
    if (!todayTop.includes(id)) {
      const [fund] = await db.select().from(mutualFunds).where(eq(mutualFunds.id, id)).limit(1);
      if (fund) {
        await add(
          "MF_DROPPED_TOP_10",
          "info",
          `${fund.schemeName} dropped out of the Direct Growth research top 10.`,
        );
      }
    }
  }

  for (const row of rows.filter((r) => r.signal === "FALLING_KNIFE").slice(0, 15)) {
    await add(
      "MF_FALLING_KNIFE",
      "high",
      `${row.schemeName} is labelled FALLING KNIFE — underlying sector momentum and recent fund returns remain weak. Not a buy signal.`,
    );
  }
  for (const row of rows.filter((r) => r.signal === "EARLY_RECOVERY_FUND").slice(0, 15)) {
    await add(
      "MF_RECOVERY",
      "medium",
      `${row.schemeName} is labelled EARLY RECOVERY FUND based on sector recovery context and relative strength. Research candidate only.`,
    );
  }
  for (const row of rows.slice(0, 80)) {
    const dd = row.currentDrawdown;
    if (dd == null) continue;
    const th = [50, 40, 30, 20, 10].find((t) => dd >= t);
    if (th != null) {
      await add(
        `MF_DRAWDOWN_${th}`,
        th >= 30 ? "high" : "medium",
        `${row.schemeName} current NAV drawdown is ${dd.toFixed(1)}% from its prior peak.`,
      );
    }
  }

  logger.info({ created: created.length, asOf }, "MF alerts written");
  return { created: created.length };
}

async function previousScoreDate(asOf: string) {
  const db = getDb();
  const r = await db.execute(sql`
    select max(date)::text as max from mutual_fund_scores where date < ${asOf}
  `);
  return (r as unknown as { max?: string }[])[0]?.max ?? null;
}

export async function listMfAlerts() {
  const db = getDb();
  return db
    .select()
    .from(alerts)
    .where(sql`${alerts.alertType} like 'MF_%'`)
    .orderBy(desc(alerts.createdAt))
    .limit(200);
}
