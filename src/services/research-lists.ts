import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  paperPositions,
  researchJournal,
  researchPortfolioLegs,
  researchPortfolios,
  thesisChecks,
  watchlistItems,
} from "@/db/schema";
import { loadScannerRows } from "@/services/queries";
import { loadFundRows } from "@/services/mf-queries";
import { loadStockRows } from "@/services/stock-metrics";

export async function listWatchlist(listName = "WATCHLIST") {
  const db = getDb();
  const items = await db
    .select()
    .from(watchlistItems)
    .where(eq(watchlistItems.listName, listName))
    .orderBy(desc(watchlistItems.updatedAt));
  const checks = await db.select().from(thesisChecks);
  const byWatch = new Map<number, typeof checks>();
  for (const c of checks) {
    const arr = byWatch.get(c.watchlistId) ?? [];
    arr.push(c);
    byWatch.set(c.watchlistId, arr);
  }
  return items.map((item) => ({
    ...item,
    thesisStatus: thesisStatus(byWatch.get(item.id) ?? []),
    checks: byWatch.get(item.id) ?? [],
  }));
}

export async function upsertWatchlist(input: {
  listName?: string;
  assetType: string;
  assetId: number;
  assetName: string;
  thesis?: string;
  entryPrice?: number;
  invalidation?: string;
  notes?: string;
  status?: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(watchlistItems)
    .values({
      listName: input.listName ?? "WATCHLIST",
      assetType: input.assetType,
      assetId: input.assetId,
      assetName: input.assetName,
      thesis: input.thesis,
      entryPrice: input.entryPrice != null ? String(input.entryPrice) : null,
      invalidation: input.invalidation,
      notes: input.notes,
      status: input.status ?? "WATCHLIST",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [watchlistItems.listName, watchlistItems.assetType, watchlistItems.assetId],
      set: {
        thesis: input.thesis,
        entryPrice: input.entryPrice != null ? String(input.entryPrice) : undefined,
        invalidation: input.invalidation,
        notes: input.notes,
        status: input.status ?? "WATCHLIST",
        assetName: input.assetName,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function removeWatchlist(id: number) {
  const db = getDb();
  await db.delete(watchlistItems).where(eq(watchlistItems.id, id));
}

function thesisStatus(checks: { status: string }[]) {
  if (!checks.length) return "UNCHECKED";
  if (checks.some((c) => c.status === "FAILED")) return "THESIS_DETERIORATING";
  if (checks.every((c) => c.status === "VALID")) return "VALID";
  return "MIXED";
}

export async function refreshThesisChecks() {
  const db = getDb();
  const items = await db.select().from(watchlistItems);
  const sectors = await loadScannerRows({ returnType: "PR" }).catch(() => []);
  const funds = await loadFundRows({ plan: "DIRECT", option: "GROWTH" }).catch(() => []);
  const stocks = await loadStockRows().catch(() => []);
  const asOf = sectors[0] ? (await import("@/services/queries")).latestMetricDate("PR") : Promise.resolve(null);
  const date = (await asOf) ?? new Date().toISOString().slice(0, 10);
  let n = 0;
  for (const item of items) {
    const conditions = parseThesisConditions(item.thesis);
    if (!conditions.length) continue;
    const snapshot = resolveAsset(item.assetType, item.assetId, sectors, funds, stocks);
    for (const cond of conditions) {
      const result = evaluateCondition(cond, snapshot);
      await db.insert(thesisChecks).values({
        watchlistId: item.id,
        date,
        condition: cond,
        status: result.status,
        detail: result.detail,
      });
      n += 1;
    }
    const latest = (await db.select().from(thesisChecks).where(eq(thesisChecks.watchlistId, item.id))).slice(-conditions.length);
    await db
      .update(watchlistItems)
      .set({ status: thesisStatus(latest), updatedAt: new Date() })
      .where(eq(watchlistItems.id, item.id));
  }
  return { checked: n, asOf: date };
}

function parseThesisConditions(thesis: string | null) {
  if (!thesis) return [];
  return thesis
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function resolveAsset(
  type: string,
  id: number,
  sectors: Awaited<ReturnType<typeof loadScannerRows>>,
  funds: Awaited<ReturnType<typeof loadFundRows>>,
  stocks: Awaited<ReturnType<typeof loadStockRows>>,
) {
  if (type === "SECTOR") return sectors.find((s) => s.indexId === id) ?? null;
  if (type === "FUND") return funds.find((f) => f.id === id) ?? null;
  if (type === "STOCK") return stocks.find((s) => s.id === id) ?? null;
  return null;
}

function evaluateCondition(cond: string, snapshot: unknown): { status: "VALID" | "FAILED" | "UNKNOWN"; detail: string } {
  if (!snapshot || typeof snapshot !== "object") return { status: "UNKNOWN", detail: "Asset snapshot unavailable." };
  const s = snapshot as Record<string, unknown>;
  const text = cond.toLowerCase();
  const num = (k: string[]) => {
    for (const key of k) {
      const v = s[key];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return null;
  };
  if (/sector recovery|recovery/.test(text)) {
    const v = num(["recoveryScore", "recovery", "overallScore"]);
    if (v == null) return { status: "UNKNOWN", detail: "Recovery score N/A." };
    return v >= 55
      ? { status: "VALID", detail: `Recovery ${v.toFixed(0)}` }
      : { status: "FAILED", detail: `Recovery ${v.toFixed(0)} is below 55.` };
  }
  if (/earnings/.test(text)) {
    const v = num(["earningsScore", "earnings"]);
    if (v == null) return { status: "UNKNOWN", detail: "Earnings score N/A — licensed fundamentals not configured." };
    return v >= 55 ? { status: "VALID", detail: `Earnings ${v.toFixed(0)}` } : { status: "FAILED", detail: `Earnings ${v.toFixed(0)}` };
  }
  if (/valuation|cheap|inexpensive/.test(text)) {
    const v = num(["valuationScore", "valuation"]);
    if (v == null) return { status: "UNKNOWN", detail: "Valuation score N/A." };
    return v >= 55 ? { status: "VALID", detail: `Valuation ${v.toFixed(0)}` } : { status: "FAILED", detail: `Valuation ${v.toFixed(0)}` };
  }
  if (/debt/.test(text)) {
    return { status: "UNKNOWN", detail: "Debt metrics N/A without licensed fundamentals." };
  }
  if (/drawdown|beaten/.test(text)) {
    const v = num(["distanceFromAth", "currentDrawdown", "drawdown"]);
    if (v == null) return { status: "UNKNOWN", detail: "Drawdown N/A." };
    return v >= 30 ? { status: "VALID", detail: `Drawdown ${v.toFixed(1)}%` } : { status: "FAILED", detail: `Drawdown ${v.toFixed(1)}%` };
  }
  return { status: "UNKNOWN", detail: `No automated rule for “${cond}”.` };
}

export async function listPaper() {
  const db = getDb();
  return db.select().from(paperPositions).orderBy(desc(paperPositions.createdAt));
}

export async function addPaper(input: {
  assetType: string;
  assetId: number;
  assetName: string;
  quantity: number;
  entryDate: string;
  entryPrice: number;
  reason?: string;
  scoreAtEntry?: number;
}) {
  const db = getDb();
  const [row] = await db
    .insert(paperPositions)
    .values({
      assetType: input.assetType,
      assetId: input.assetId,
      assetName: input.assetName,
      quantity: String(input.quantity),
      entryDate: input.entryDate,
      entryPrice: String(input.entryPrice),
      reason: input.reason,
      scoreAtEntry: input.scoreAtEntry != null ? String(input.scoreAtEntry) : null,
    })
    .returning();
  return row;
}

export async function closePaper(id: number, exitDate: string, exitPrice: number) {
  const db = getDb();
  await db
    .update(paperPositions)
    .set({ exitDate, exitPrice: String(exitPrice) })
    .where(eq(paperPositions.id, id));
}

export async function listJournal() {
  const db = getDb();
  return db.select().from(researchJournal).orderBy(desc(researchJournal.createdAt));
}

export async function addJournal(input: {
  date: string;
  assetType?: string;
  assetId?: number;
  assetName?: string;
  thesis?: string;
  evidence?: string;
  decision?: string;
  outcome?: string;
}) {
  const db = getDb();
  const [row] = await db.insert(researchJournal).values(input).returning();
  return row;
}

export async function listPortfolios() {
  const db = getDb();
  const ports = await db.select().from(researchPortfolios).orderBy(desc(researchPortfolios.updatedAt));
  const legs = await db.select().from(researchPortfolioLegs);
  return ports.map((p) => ({ ...p, legs: legs.filter((l) => l.portfolioId === p.id) }));
}

export async function upsertPortfolio(input: {
  id?: number;
  name: string;
  kind?: string;
  notes?: string;
  riskLimits?: Record<string, number>;
  legs: { assetType: string; assetId: number; assetName: string; weightPct: number }[];
}) {
  const db = getDb();
  let id = input.id;
  if (id) {
    await db
      .update(researchPortfolios)
      .set({
        name: input.name,
        kind: input.kind ?? "RESEARCH",
        notes: input.notes,
        riskLimits: input.riskLimits,
        updatedAt: new Date(),
      })
      .where(eq(researchPortfolios.id, id));
    await db.delete(researchPortfolioLegs).where(eq(researchPortfolioLegs.portfolioId, id));
  } else {
    const [row] = await db
      .insert(researchPortfolios)
      .values({
        name: input.name,
        kind: input.kind ?? "RESEARCH",
        notes: input.notes,
        riskLimits: input.riskLimits,
      })
      .returning();
    id = row.id;
  }
  if (input.legs.length) {
    await db.insert(researchPortfolioLegs).values(
      input.legs.map((l) => ({
        portfolioId: id!,
        assetType: l.assetType,
        assetId: l.assetId,
        assetName: l.assetName,
        weightPct: String(l.weightPct),
      })),
    );
  }
  return listPortfolios();
}

export function portfolioRiskWarnings(
  legs: { assetType: string; assetName: string; weightPct: number; sector?: string | null }[],
  limits: { maxSingle?: number; maxSector?: number; maxFund?: number } = {},
) {
  const warnings: string[] = [];
  const maxSingle = limits.maxSingle ?? 15;
  const maxSector = limits.maxSector ?? 35;
  const maxFund = limits.maxFund ?? 25;
  for (const leg of legs) {
    if (leg.weightPct > maxSingle) warnings.push(`${leg.assetName} is ${leg.weightPct}% — above the ${maxSingle}% single-name limit.`);
    if (leg.assetType === "FUND" && leg.weightPct > maxFund) {
      warnings.push(`${leg.assetName} is ${leg.weightPct}% — above the ${maxFund}% single-fund limit.`);
    }
  }
  const bySector = new Map<string, number>();
  for (const leg of legs) {
    if (!leg.sector) continue;
    bySector.set(leg.sector, (bySector.get(leg.sector) ?? 0) + leg.weightPct);
  }
  for (const [sector, w] of bySector) {
    if (w > maxSector) warnings.push(`${sector} exposure is ${w.toFixed(1)}% — above the ${maxSector}% sector limit.`);
  }
  const total = legs.reduce((a, l) => a + l.weightPct, 0);
  if (Math.abs(total - 100) > 1) warnings.push(`Weights sum to ${total.toFixed(1)}%, not 100%.`);
  return warnings;
}
