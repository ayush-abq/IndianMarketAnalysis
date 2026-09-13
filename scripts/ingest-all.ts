import { closeDb } from "../src/db/client";
import { logger } from "../src/lib/logger";
import { runIngestion } from "../src/services/ingestion";
import { runMfIngestion } from "../src/services/mf-ingestion";
import { runStockIngestion } from "../src/services/stock-ingestion";

type EngineResult = { engine: string; result: unknown; ok: boolean };

/**
 * Full official history for every engine, then scores.
 *
 *   npm run ingest:all
 *   npm run ingest:all -- --from=2015-01-01   # stock bhavcopy start only
 *
 * Resume-safe: days already stored are skipped. Do not run a second stock
 * backfill at the same time as this command.
 */
async function main() {
  const fromArg = process.argv.find((a) => a.startsWith("--from="));
  const from = fromArg?.slice("--from=".length);
  const started = Date.now();
  const results: EngineResult[] = [];

  console.log("\nIndian Market Intelligence Terminal — full official ingest\n");
  console.log("NSE index EOD → AMFI NAV history → stock bhavcopy → scores");
  console.log("This can take hours. Safe to stop and rerun; completed days are skipped.\n");

  results.push(await runEngine("NSE sectors", () => runIngestion("backfill")));
  results.push(await runEngine("Mutual funds", () => runMfIngestion("backfill")));
  results.push(await runEngine("Stocks", () => runStockIngestion("backfill", from ? { from } : {})));

  const failed = results.filter((r) => !r.ok);
  console.log("\n—— Full ingest summary ——");
  for (const r of results) {
    const status =
      r.result && typeof r.result === "object" && "status" in r.result
        ? String((r.result as { status: string }).status)
        : r.ok
          ? "ok"
          : "failed";
    console.log(`${r.ok ? "✓" : "✗"} ${r.engine}: ${status}`);
    console.log(JSON.stringify(r.result, null, 2));
  }
  console.log(`Elapsed ${(Date.now() - started) / 1000}s\n`);

  await closeDb();
  if (failed.length) process.exit(1);
}

async function runEngine(engine: string, fn: () => Promise<unknown>): Promise<EngineResult> {
  logger.info({ engine }, "Full ingest — starting engine");
  try {
    const result = await fn();
    logger.info({ engine, result }, "Full ingest — engine finished");
    const status =
      result && typeof result === "object" && "status" in result
        ? String((result as { status: string }).status)
        : "ok";
    return { engine, result, ok: status !== "failed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ engine, err }, "Full ingest — engine failed; continuing");
    return { engine, result: { status: "failed", error: message }, ok: false };
  }
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
