import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dataIngestionRuns } from "@/db/schema";
import { env } from "@/lib/env";
import { formatIstStamp, nextCronIst } from "@/lib/next-cron";
import { expectedDataDate } from "@/services/calendar";
import { runIngestion } from "@/services/ingestion";
import { runMfIngestion } from "@/services/mf-ingestion";
import { runStockIngestion } from "@/services/stock-ingestion";
import { MF_MONTHLY_CRON } from "@/config/mf-defaults";
import { logger } from "@/lib/logger";

export type IngestKind = "today" | "history";

export type IngestJob = {
  kind: IngestKind;
  status: "running" | "success" | "failed";
  startedAt: string;
  finishedAt: string | null;
  steps: { engine: string; status: string; note?: string }[];
  error?: string;
};

let job: IngestJob | null = null;

function lastRun(provider: string) {
  const db = getDb();
  return db
    .select()
    .from(dataIngestionRuns)
    .where(eq(dataIngestionRuns.provider, provider))
    .orderBy(desc(dataIngestionRuns.startedAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export function getActiveIngestJob() {
  return job;
}

export async function ingestControlStatus() {
  const [nse, mf, stocks, running] = await Promise.all([
    lastRun("NSE_OFFICIAL_EOD"),
    lastRun("AMFI"),
    lastRun("NSE_OFFICIAL_BHAVCOPY"),
    getDb()
      .select()
      .from(dataIngestionRuns)
      .where(eq(dataIngestionRuns.status, "running"))
      .orderBy(desc(dataIngestionRuns.startedAt))
      .limit(5),
  ]);
  const db = getDb();
  const indexThrough = await db.execute(sql`select max(date)::text as d from index_prices`);
  const stockThrough = await db.execute(sql`select max(date)::text as d from stock_prices`);
  const navThrough = await db.execute(sql`select max(date)::text as d from mutual_fund_nav`);
  const expected = await expectedDataDate();
  const tz = env().SCHEDULER_TZ;
  const nseNext = nextCronIst(env().SCHEDULER_CRON);
  const stockNext = nextCronIst(env().STOCK_BHAV_CRON);
  const mfNext = nextCronIst(env().MF_NAV_CRON);
  const mfMonthly = nextCronIst(MF_MONTHLY_CRON);

  const busy = job?.status === "running" || running.length > 0;

  return {
    now: formatIstStamp(new Date()),
    expectedSession: expected,
    busy,
    job,
    runningJobs: running.map((r) => ({
      provider: r.provider,
      jobKey: r.jobKey,
      startedAt: formatIstStamp(r.startedAt),
    })),
    engines: [
      {
        id: "indexes",
        title: "Sectors & indexes",
        what: "Official NSE end-of-day index closes. Needed for Today, radar, and drawdowns.",
        lastAdded: formatIstStamp(nse?.completedAt ?? nse?.startedAt),
        lastStatus: nse?.status ?? "never",
        dataThrough: (indexThrough as unknown as { d: string }[])[0]?.d ?? null,
        nextAdd: formatIstStamp(nseNext),
        nextHint: "Weekdays at 6:30 PM IST, after the cash market close — if the worker is running.",
        cron: env().SCHEDULER_CRON,
        tz,
      },
      {
        id: "stocks",
        title: "Stocks",
        what: "Official NSE bhavcopy closes. Needed for stock 1Y, ATH, breakouts.",
        lastAdded: formatIstStamp(stocks?.completedAt ?? stocks?.startedAt),
        lastStatus: stocks?.status ?? "never",
        dataThrough: (stockThrough as unknown as { d: string }[])[0]?.d ?? null,
        nextAdd: formatIstStamp(stockNext),
        nextHint: "Weekdays at 6:45 PM IST — if the worker is running.",
        cron: env().STOCK_BHAV_CRON,
        tz,
      },
      {
        id: "funds",
        title: "Mutual funds",
        what: "Official AMFI NAVs. Needed for fund scores, 1Y/5Y and major-fund table.",
        lastAdded: formatIstStamp(mf?.completedAt ?? mf?.startedAt),
        lastStatus: mf?.status ?? "never",
        dataThrough: (navThrough as unknown as { d: string }[])[0]?.d ?? null,
        nextAdd: formatIstStamp(mfNext),
        nextHint: "Monday–Saturday at 10:00 PM IST — if the worker is running.",
        cron: env().MF_NAV_CRON,
        tz,
        extra: `Monthly full NAV history: ${formatIstStamp(mfMonthly)}`,
      },
    ],
    actions: {
      today: {
        label: "Update latest files",
        time: "Usually 1–5 minutes",
        when: "Use after market close, or if Today looks stale.",
      },
      history: {
        label: "Fill missing history",
        time: "Can take hours",
        when: "Use once when history is short. Already-stored days are skipped.",
      },
    },
    worker: "For automatic updates leave `npm run worker` running. These buttons do the same jobs by hand.",
  };
}

export function startIngestFromUi(kind: IngestKind) {
  if (job?.status === "running") {
    return { accepted: false as const, reason: "An update is already running in this app.", job };
  }
  job = {
    kind,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    steps: [],
  };
  void runJob(job, kind);
  return { accepted: true as const, job };
}

async function runJob(active: IngestJob, kind: IngestKind) {
  const mode = kind === "history" ? "backfill" : "manual";
  const steps: { name: string; fn: () => Promise<{ status?: string }> }[] = [
    { name: "Sectors & indexes", fn: () => runIngestion(mode) },
    { name: "Mutual funds", fn: () => runMfIngestion(mode) },
    { name: "Stocks", fn: () => runStockIngestion(mode, kind === "history" ? { from: env().NSE_HISTORICAL_START } : {}) },
  ];
  try {
    for (const step of steps) {
      logger.info({ engine: step.name, kind }, "UI ingest — starting engine");
      const result = await step.fn();
      const status = result && typeof result === "object" && "status" in result ? String(result.status) : "ok";
      active.steps.push({
        engine: step.name,
        status,
        note: status === "skipped" ? "Already stored for this session." : status,
      });
      if (status === "failed") active.status = "failed";
    }
    if (active.status !== "failed") active.status = "success";
  } catch (err) {
    active.status = "failed";
    active.error = err instanceof Error ? err.message : String(err);
    logger.error({ err, kind }, "UI ingest failed");
  } finally {
    active.finishedAt = new Date().toISOString();
  }
}
