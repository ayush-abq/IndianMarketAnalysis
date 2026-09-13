import { spawn } from "node:child_process";
import postgres from "postgres";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../src/lib/env";
import { logger } from "../src/lib/logger";

async function waitForDb(url: string) {
  for (let i = 0; i < 40; i++) {
    try {
      const sql = postgres(url, { max: 1, connect_timeout: 5 });
      await sql`select 1`;
      await sql.end();
      return;
    } catch {
      logger.info({ attempt: i + 1 }, "Waiting for PostgreSQL");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error("PostgreSQL did not become ready");
}

async function main() {
  const url = env().DATABASE_URL;
  await waitForDb(url);
  const sql = postgres(url, { max: 1 });
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(path.resolve("drizzle"))).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await sql.unsafe(await readFile(path.resolve("drizzle", file), "utf8"));
  }
  await sql.end();
  logger.info("Database migrated");

  const { seedSettings } = await import("../src/services/settings");
  const { seedHolidays } = await import("../src/services/calendar");
  const { ensureUniverse, runIngestion } = await import("../src/services/ingestion");
  const { getDb } = await import("../src/db/client");
  const { indexPrices } = await import("../src/db/schema");

  await seedSettings();
  await seedHolidays();
  await ensureUniverse();

  const db = getDb();
  const existing = await db.select({ id: indexPrices.id }).from(indexPrices).limit(1);
  if (!existing.length) {
    logger.info("Empty price database — starting official/authorized historical backfill");
    await runIngestion("backfill");
  } else {
    logger.info("Price history present — running daily incremental ingest");
    await runIngestion("daily");
  }

  const { mutualFundNav } = await import("../src/db/schema");
  const { runMfIngestion } = await import("../src/services/mf-ingestion");
  const mfExisting = await db.select({ id: mutualFundNav.id }).from(mutualFundNav).limit(1);
  if (!mfExisting.length) {
    logger.info("Empty mutual-fund NAV table — official AMFI ingest");
    await runMfIngestion("daily");
  }

  if (process.argv.includes("--no-start")) return;

  const port = String(env().APP_PORT);
  const next = spawn("npx", ["next", "start", "-p", port], { stdio: "inherit" });
  const worker = spawn("npx", ["tsx", "src/workers/scheduler.ts"], { stdio: "inherit" });
  const shutdown = () => {
    next.kill("SIGTERM");
    worker.kill("SIGTERM");
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
