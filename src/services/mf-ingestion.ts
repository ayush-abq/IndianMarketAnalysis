import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  dataIngestionRuns,
  mutualFundAum,
  mutualFundExpenses,
  mutualFundFreshness,
  mutualFundHoldings,
  mutualFundNav,
  mutualFundPortfolio,
  mutualFunds,
} from "@/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { jobKeyFor } from "@/services/ingestion-key";
import { todayIST } from "@/lib/utils";
import { createMfEnrichmentProvider, createMfProvider } from "@/providers/mf";
import type { AmfiSchemeRow } from "@/mf/amfi-parse";
import { recomputeMutualFunds } from "@/services/mf-metrics";
import { generateMfAlerts } from "@/services/mf-alerts";

export async function runMfIngestion(mode: "daily" | "backfill" | "manual" = "daily") {
  const asOf = todayIST();
  const key = `mf:${jobKeyFor(asOf, mode)}`;
  const db = getDb();
  const existing = await db
    .select()
    .from(dataIngestionRuns)
    .where(and(eq(dataIngestionRuns.jobKey, key), eq(dataIngestionRuns.status, "success")));
  if (existing.length && mode !== "manual") {
    logger.info({ key }, "MF ingestion already completed");
    return { status: "skipped" as const, asOf };
  }

  const [run] = await db
    .insert(dataIngestionRuns)
    .values({ provider: env().MF_PROVIDER, status: "running", jobKey: key })
    .returning();

  let downloaded = 0;
  let inserted = 0;
  try {
    const provider = createMfProvider();
    const universe = await provider.getSchemeUniverse();
    downloaded += universe.length;
    inserted += await upsertSchemesAndNav(universe);

    const navCount = await db.execute(sql`select count(*)::int as n from mutual_fund_nav`);
    const have = Number((navCount as unknown as { n: number }[])[0]?.n ?? 0);
    if (mode === "backfill") {
      const hist = await backfillHistory(provider, env().MF_HISTORICAL_START, asOf);
      downloaded += hist.downloaded;
      inserted += hist.inserted;
    } else if (have < 50_000) {
      const from = monthsAgo(asOf, 12);
      logger.info({ from, asOf }, "Sparse NAV history — official AMFI 12-month backfill (full history via --backfill)");
      const hist = await backfillHistory(provider, from, asOf);
      downloaded += hist.downloaded;
      inserted += hist.inserted;
    }

    if (mode === "backfill" || isMonthlyWindow(asOf)) {
      inserted += await enrichLicensedMonthly();
    }

    const computed = await recomputeMutualFunds(undefined, { allPlans: mode === "backfill" });
    await generateMfAlerts(computed.asOf ?? asOf).catch((err) =>
      logger.warn({ err }, "MF alerts generation failed"),
    );
    await db
      .update(dataIngestionRuns)
      .set({
        status: "success",
        completedAt: new Date(),
        recordsDownloaded: downloaded,
        recordsInserted: inserted,
        details: { asOf, computed: computed.computed, engine: "mutual_fund" },
      })
      .where(eq(dataIngestionRuns.id, run.id));
    logger.info({ asOf, downloaded, inserted, computed: computed.computed }, "MF ingestion complete");
    return { status: "success" as const, asOf, downloaded, inserted, computed: computed.computed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "MF ingestion failed — previous NAV retained");
    await db
      .update(dataIngestionRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: message,
        recordsDownloaded: downloaded,
        recordsInserted: inserted,
      })
      .where(eq(dataIngestionRuns.id, run.id));
    return { status: "failed" as const, asOf, error: message };
  }
}

export async function upsertSchemesAndNav(rows: AmfiSchemeRow[]) {
  const db = getDb();
  const byCode = new Map<string, AmfiSchemeRow>();
  for (const row of rows) byCode.set(row.schemeCode, row);
  const unique = [...byCode.values()];
  const chunk = 200;
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk).map((row) => ({
      schemeName: row.schemeName,
      amcName: row.amcName,
      schemeCode: row.schemeCode,
      isin: row.isin,
      isinReinvest: row.isinReinvest,
      plan: row.plan,
      option: row.option,
      assetClass: row.assetClass,
      category: row.category,
      schemeType: row.schemeType,
      active: true,
      status: "active",
      updatedAt: new Date(),
    }));
    await db
      .insert(mutualFunds)
      .values(slice)
      .onConflictDoUpdate({
        target: mutualFunds.schemeCode,
        set: {
          schemeName: sql`excluded.scheme_name`,
          amcName: sql`excluded.amc_name`,
          isin: sql`excluded.isin`,
          plan: sql`excluded.plan`,
          option: sql`excluded.option`,
          assetClass: sql`excluded.asset_class`,
          category: sql`excluded.category`,
          updatedAt: new Date(),
        },
      });
  }

  const funds = await db.select({ id: mutualFunds.id, schemeCode: mutualFunds.schemeCode }).from(mutualFunds);
  const idByCode = new Map(funds.map((f) => [f.schemeCode, f.id]));
  const navs = [];
  const freshness = [];
  for (const row of unique) {
    const fundId = idByCode.get(row.schemeCode);
    if (!fundId) continue;
    navs.push({ fundId, date: row.date, nav: String(row.nav) });
    freshness.push({ fundId, navUpdated: row.date });
  }
  await upsertNavRows(navs);
  for (let i = 0; i < freshness.length; i += chunk) {
    await db
      .insert(mutualFundFreshness)
      .values(freshness.slice(i, i + chunk))
      .onConflictDoUpdate({
        target: mutualFundFreshness.fundId,
        set: { navUpdated: sql`excluded.nav_updated` },
      });
  }
  return unique.length;
}

async function backfillHistory(
  provider: ReturnType<typeof createMfProvider>,
  start: string,
  end: string,
) {
  let downloaded = 0;
  let inserted = 0;
  const months = monthWindows(start, end);
  logger.info({ months: months.length, start, end }, "AMFI official NAV history backfill");
  for (const [from, to] of months) {
    try {
      const rows = await provider.getNavHistory(from, to);
      downloaded += rows.length;
      inserted += await upsertNavOnly(rows);
    } catch (err) {
      logger.warn({ err, from, to }, "AMFI history window failed — skipping");
    }
  }
  return { downloaded, inserted };
}

async function upsertNavOnly(rows: AmfiSchemeRow[]) {
  const db = getDb();
  if (!rows.length) return 0;
  const funds = await db.select({ id: mutualFunds.id, schemeCode: mutualFunds.schemeCode }).from(mutualFunds);
  const idByCode = new Map(funds.map((f) => [f.schemeCode, f.id]));
  const values = [];
  for (const row of rows) {
    const fundId = idByCode.get(row.schemeCode);
    if (!fundId) continue;
    values.push({ fundId, date: row.date, nav: String(row.nav) });
  }
  return upsertNavRows(values);
}

async function upsertNavRows(values: { fundId: number; date: string; nav: string }[]) {
  const db = getDb();
  let inserted = 0;
  const chunk = 800;
  for (let i = 0; i < values.length; i += chunk) {
    const slice = values.slice(i, i + chunk);
    if (!slice.length) continue;
    await db
      .insert(mutualFundNav)
      .values(slice)
      .onConflictDoUpdate({
        target: [mutualFundNav.fundId, mutualFundNav.date],
        set: { nav: sql`excluded.nav` },
      });
    inserted += slice.length;
  }
  return inserted;
}

/**
 * Portfolio / TER / AUM / manager are not in official daily NAVAll.
 * Pulled only when a licensed/authorized feed is configured. Never fabricated.
 */
async function enrichLicensedMonthly() {
  const licensed = createMfEnrichmentProvider();
  if (!licensed) {
    logger.info("Licensed MF enrichment skipped — MF_LICENSED_BASE_URL / MF_API_KEY not set");
    return 0;
  }
  const db = getDb();
  const funds = await db
    .select()
    .from(mutualFunds)
    .where(and(eq(mutualFunds.active, true), eq(mutualFunds.plan, "DIRECT"), eq(mutualFunds.option, "GROWTH")));
  let n = 0;
  const asOf = todayIST();
  for (const fund of funds.slice(0, 400)) {
    try {
      const ter = licensed.getExpenseRatio ? await licensed.getExpenseRatio(fund.schemeCode) : null;
      const aum = licensed.getAum ? await licensed.getAum(fund.schemeCode) : null;
      const port = licensed.getPortfolio ? await licensed.getPortfolio(fund.schemeCode) : [];
      const manager = licensed.getFundManager ? await licensed.getFundManager(fund.schemeCode) : null;
      const riskometer = licensed.getRiskometer ? await licensed.getRiskometer(fund.schemeCode) : null;
      const benchmark = licensed.getBenchmark ? await licensed.getBenchmark(fund.schemeCode) : null;
      if (ter) {
        await db
          .insert(mutualFundExpenses)
          .values({
            fundId: fund.id,
            date: ter.date,
            expenseRatio: String(ter.ter),
            directExpenseRatio: fund.plan === "DIRECT" ? String(ter.ter) : null,
            regularExpenseRatio: fund.plan === "REGULAR" ? String(ter.ter) : null,
          })
          .onConflictDoUpdate({
            target: [mutualFundExpenses.fundId, mutualFundExpenses.date],
            set: { expenseRatio: String(ter.ter) },
          });
        await db
          .insert(mutualFundFreshness)
          .values({ fundId: fund.id, terUpdated: ter.date })
          .onConflictDoUpdate({ target: mutualFundFreshness.fundId, set: { terUpdated: ter.date } });
        n += 1;
      }
      if (aum) {
        await db
          .insert(mutualFundAum)
          .values({ fundId: fund.id, date: aum.date, aum: String(aum.aum) })
          .onConflictDoUpdate({
            target: [mutualFundAum.fundId, mutualFundAum.date],
            set: { aum: String(aum.aum) },
          });
        await db
          .insert(mutualFundFreshness)
          .values({ fundId: fund.id, aumUpdated: aum.date })
          .onConflictDoUpdate({ target: mutualFundFreshness.fundId, set: { aumUpdated: aum.date } });
        n += 1;
      }
      if (port?.length) {
        await db.delete(mutualFundHoldings).where(and(eq(mutualFundHoldings.fundId, fund.id), eq(mutualFundHoldings.date, asOf)));
        await db.insert(mutualFundHoldings).values(
          port.map((h) => ({
            fundId: fund.id,
            date: asOf,
            securityName: h.securityName,
            isin: h.isin ?? null,
            weight: String(h.weight),
            sector: h.sector ?? null,
            marketCap: h.marketCap ?? null,
          })),
        );
        const weights = [...port].sort((a, b) => b.weight - a.weight);
        await db
          .insert(mutualFundPortfolio)
          .values({
            fundId: fund.id,
            date: asOf,
            stockCount: port.length,
            top5Percent: String(weights.slice(0, 5).reduce((a, h) => a + h.weight, 0)),
            top10Percent: String(weights.slice(0, 10).reduce((a, h) => a + h.weight, 0)),
          })
          .onConflictDoUpdate({
            target: [mutualFundPortfolio.fundId, mutualFundPortfolio.date],
            set: { stockCount: port.length },
          });
        await db
          .insert(mutualFundFreshness)
          .values({ fundId: fund.id, portfolioUpdated: asOf })
          .onConflictDoUpdate({ target: mutualFundFreshness.fundId, set: { portfolioUpdated: asOf } });
        n += 1;
      }
      if (manager || riskometer || benchmark) {
        await db
          .update(mutualFunds)
          .set({
            fundManager: manager?.name ?? fund.fundManager,
            managerTenureYears: manager?.tenureYears != null ? String(manager.tenureYears) : fund.managerTenureYears,
            riskometer: riskometer ?? fund.riskometer,
            benchmark: typeof benchmark === "string" ? benchmark : fund.benchmark,
            updatedAt: new Date(),
          })
          .where(eq(mutualFunds.id, fund.id));
      }
    } catch (err) {
      logger.warn({ err, scheme: fund.schemeCode }, "Licensed MF enrichment failed for scheme");
    }
  }
  return n;
}

function monthWindows(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end) {
    const start = cur.toISOString().slice(0, 10);
    const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
    const last = next > end ? to : next.toISOString().slice(0, 10);
    out.push([start, last]);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
    cur.setUTCDate(1);
  }
  return out;
}

function monthsAgo(iso: string, months: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function isMonthlyWindow(iso: string) {
  return Number(iso.slice(8, 10)) <= 3;
}
