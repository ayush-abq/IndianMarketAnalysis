import { runStockIngestion } from "../src/services/stock-ingestion";
import { closeDb } from "../src/db/client";

const mode = process.argv.includes("--backfill") ? "backfill" : process.argv.includes("--manual") ? "manual" : "daily";
const fromArg = process.argv.find((a) => a.startsWith("--from="));
const from = fromArg?.slice("--from=".length);

async function main() {
  const result = await runStockIngestion(mode, from ? { from } : {});
  console.log(JSON.stringify(result, null, 2));
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
