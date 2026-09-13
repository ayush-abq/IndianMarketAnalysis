import { runIngestion } from "../src/services/ingestion";
import { closeDb } from "../src/db/client";

const mode = process.argv.includes("--backfill") ? "backfill" : process.argv.includes("--manual") ? "manual" : "daily";

async function main() {
  const result = await runIngestion(mode);
  console.log(JSON.stringify(result, null, 2));
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
