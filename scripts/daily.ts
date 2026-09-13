import { closeDb } from "../src/db/client";
import { logger } from "../src/lib/logger";
import { runIngestion } from "../src/services/ingestion";
import { runMfIngestion } from "../src/services/mf-ingestion";
import { runStockIngestion } from "../src/services/stock-ingestion";

type EngineResult = { engine: string; result: unknown; ok: boolean };

/**
 * One-shot daily cycle for the whole terminal.
 * Same work the scheduler does, without leaving a process running.
 *
 *   npm run daily
 *   npm run daily -- --manual    # force even if today's job already succeeded
 */
async function main() {
  const mode = process.argv.includes("--manual") ? "manual" : "daily";
  const started = Date.now();
  const results: EngineResult[] = [];

  console.log(`\nIndian Market Intelligence Terminal — daily cycle (${mode})\n`);

  results.push(await runEngine("NSE sectors", () => runIngestion(mode)));
  results.push(await runEngine("Mutual funds", () => runMfIngestion(mode)));
  results.push(await runEngine("Stocks", () => runStockIngestion(mode)));

  const failed = results.filter((r) => !r.ok);
  console.log("\n—— Daily cycle summary ——");
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
  logger.info({ engine }, "Daily cycle — starting engine");
  try {
    const result = await fn();
    logger.info({ engine, result }, "Daily cycle — engine finished");
    const status = result && typeof result === "object" && "status" in result ? String((result as { status: string }).status) : "ok";
    return { engine, result, ok: status !== "failed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ engine, err }, "Daily cycle — engine failed; continuing");
    return { engine, result: { status: "failed", error: message }, ok: false };
  }
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
