import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { researchSignals } from "@/db/schema";
import { loadBars } from "@/services/metrics";
import { labeledForward } from "@/services/strategy-lab";
import { loadStockBars } from "@/services/stock-metrics";
import { loadNavSeries } from "@/services/mf-queries";
import { MODEL_VERSIONS, SAMPLE_CAUTION } from "@/config/terminal-defaults";
import { confidenceLabel } from "@/scoring/opportunity-classify";
import { median } from "@/services/strategy-lab";

export async function recordSignals(
  date: string,
  items: {
    assetType: string;
    assetId: number;
    assetName: string;
    screen: string;
    signal: string;
    score?: number | null;
    payload?: unknown;
  }[],
) {
  if (!items.length) return 0;
  const db = getDb();
  await db.insert(researchSignals).values(
    items.map((i) => ({
      date,
      assetType: i.assetType,
      assetId: i.assetId,
      assetName: i.assetName,
      screen: i.screen,
      signal: i.signal,
      score: i.score != null ? String(i.score) : null,
      payload: i.payload ?? null,
      modelVersion: MODEL_VERSIONS.opportunity,
    })),
  );
  return items.length;
}

export async function fillSignalForwards() {
  const db = getDb();
  const open = await db.select().from(researchSignals).where(isNull(researchSignals.forwardFilledAt)).limit(2000);
  let filled = 0;
  for (const row of open) {
    const bars = await barsFor(row.assetType, row.assetId);
    if (!bars.length) continue;
    const f1 = labeledForward(bars, row.date, 21);
    const f3 = labeledForward(bars, row.date, 63);
    const f6 = labeledForward(bars, row.date, 126);
    const f12 = labeledForward(bars, row.date, 252);
    if (f1 == null && f3 == null && f6 == null && f12 == null) continue;
    await db
      .update(researchSignals)
      .set({
        forward1m: f1 != null ? String(f1) : row.forward1m,
        forward3m: f3 != null ? String(f3) : row.forward3m,
        forward6m: f6 != null ? String(f6) : row.forward6m,
        forward1y: f12 != null ? String(f12) : row.forward1y,
        forwardFilledAt: f12 != null ? new Date() : null,
      })
      .where(eq(researchSignals.id, row.id));
    filled += 1;
  }
  return { open: open.length, filled };
}

async function barsFor(type: string, id: number): Promise<{ date: string; close: number }[]> {
  if (type === "SECTOR") return loadBars(id, "PR");
  if (type === "STOCK") return loadStockBars(id);
  if (type === "FUND") {
    const nav = await loadNavSeries(id);
    return nav.map((p) => ({ date: p.date, close: Number(p.nav) }));
  }
  return [];
}

export async function calibrateScreen(screen: string) {
  const db = getDb();
  const rows = await db.select().from(researchSignals).where(eq(researchSignals.screen, screen));
  const fwd = rows.map((r) => (r.forward1y != null ? Number(r.forward1y) : null)).filter((v): v is number => v != null);
  const caution = confidenceLabel(fwd.length, 100);
  return {
    screen,
    sample: fwd.length,
    signals: rows.length,
    winRate: fwd.length ? (fwd.filter((v) => v > 0).length / fwd.length) * 100 : null,
    medianForward1y: median(fwd),
    averageForward1y: fwd.length ? fwd.reduce((a, b) => a + b, 0) / fwd.length : null,
    downsideFrequency: fwd.length ? (fwd.filter((v) => v < 0).length / fwd.length) * 100 : null,
    confidence: caution.confidence,
    note:
      fwd.length < SAMPLE_CAUTION.insufficient
        ? `Historical sample: ${fwd.length} occurrences — insufficient evidence.`
        : caution.note,
  };
}

export async function historicalAnalogues(input: {
  drawdown: number;
  recovery?: number | null;
  quality?: number | null;
}) {
  const db = getDb();
  const rows = await db.select().from(researchSignals);
  const similar = rows.filter((r) => {
    const payload = (r.payload ?? {}) as { drawdown?: number; recovery?: number; quality?: number };
    if (payload.drawdown == null) return false;
    if (Math.abs(payload.drawdown - input.drawdown) > 8) return false;
    if (input.recovery != null && payload.recovery != null && Math.abs(payload.recovery - input.recovery) > 15) return false;
    if (input.quality != null && payload.quality != null && Math.abs(payload.quality - input.quality) > 15) return false;
    return true;
  });
  const f6 = similar.map((r) => (r.forward6m != null ? Number(r.forward6m) : null)).filter((v): v is number => v != null);
  const f12 = similar.map((r) => (r.forward1y != null ? Number(r.forward1y) : null)).filter((v): v is number => v != null);
  const caution = confidenceLabel(Math.max(f6.length, f12.length), 100);
  return {
    comparable: similar.length,
    median6m: median(f6),
    median12m: median(f12),
    negative12m: f12.length ? (f12.filter((v) => v < 0).length / f12.length) * 100 : null,
    confidence: caution.confidence,
    note: caution.note,
    disclaimer: "Historical analogues are not predictions. They describe subsequent outcomes of similar past setups.",
  };
}

export async function recordRadarSignals(asOf: string) {
  const { buildOpportunityRadar } = await import("@/services/opportunity-radar");
  const radar = await buildOpportunityRadar();
  const items = [
    ...radar.lists.earlyRecovery.map((i) => ({ ...i, screen: "EARLY_RECOVERY" })),
    ...radar.lists.fallingKnives.map((i) => ({ ...i, screen: "FALLING_KNIFE" })),
    ...radar.lists.qarp.map((i) => ({ ...i, screen: "QARP" })),
    ...radar.lists.valueTraps.map((i) => ({ ...i, screen: "VALUE_TRAP" })),
  ];
  const db = getDb();
  const existing = await db
    .select()
    .from(researchSignals)
    .where(and(eq(researchSignals.date, asOf)));
  const seen = new Set(existing.map((e) => `${e.assetType}|${e.assetId}|${e.screen}`));
  const fresh = items.filter((i) => !seen.has(`${i.type}|${i.id}|${i.screen}`));
  return recordSignals(
    asOf,
    fresh.map((i) => ({
      assetType: i.type,
      assetId: i.id,
      assetName: i.name,
      screen: i.screen,
      signal: i.classification,
      score: i.opportunity,
      payload: { drawdown: i.drawdown, recovery: i.recovery, quality: i.quality },
    })),
  );
}
