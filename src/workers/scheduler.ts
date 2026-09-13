import cron from "node-cron";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { runIngestion } from "@/services/ingestion";
import { runMfIngestion } from "@/services/mf-ingestion";
import { runStockIngestion } from "@/services/stock-ingestion";
import { persistLatestPredictions } from "@/services/local-ai-layer";
import { getSettings } from "@/services/settings";
import { MF_MONTHLY_CRON } from "@/config/mf-defaults";

async function tickNse() {
  logger.info("Scheduler tick — official/authorized NSE ingest → local DB → calculations");
  const result = await runIngestion("daily");
  logger.info(result, "Scheduled NSE ingestion finished");
}

async function tickMf(mode: "daily" | "backfill" = "daily") {
  logger.info({ mode }, "Scheduler tick — official AMFI / licensed MF ingest");
  const result = await runMfIngestion(mode);
  logger.info(result, "Scheduled MF ingestion finished");
}

async function main() {
  const settings = await getSettings().catch(() => null);
  const expr = settings?.scheduler_cron ?? env().SCHEDULER_CRON;
  const tz = env().SCHEDULER_TZ;
  logger.info({ expr, tz, provider: env().DATA_PROVIDER, mfCron: env().MF_NAV_CRON }, "Worker started");
  cron.schedule(
    expr,
    () => {
      tickNse().catch((err) => logger.error({ err }, "Scheduled NSE job failed"));
    },
    { timezone: tz },
  );
  cron.schedule(
    env().MF_NAV_CRON,
    () => {
      tickMf("daily").catch((err) => logger.error({ err }, "Scheduled MF NAV job failed"));
    },
    { timezone: tz },
  );
  cron.schedule(
    env().STOCK_BHAV_CRON,
    () => {
      runStockIngestion("daily")
        .then(() => persistLatestPredictions(200).catch((err) => logger.warn({ err }, "ML predict skipped")))
        .catch((err) => logger.error({ err }, "Scheduled stock bhavcopy job failed"));
    },
    { timezone: tz },
  );
  cron.schedule(
    MF_MONTHLY_CRON,
    () => {
      tickMf("backfill").catch((err) => logger.error({ err }, "Scheduled MF monthly job failed"));
    },
    { timezone: tz },
  );
  if (process.argv.includes("--once")) {
    await tickNse();
    await tickMf("daily");
    process.exit(0);
  }
}

main().catch((err) => {
  logger.error({ err }, "Worker crashed");
  process.exit(1);
});
