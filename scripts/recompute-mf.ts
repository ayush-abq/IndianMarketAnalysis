import { recomputeMutualFunds } from "../src/services/mf-metrics";
import { closeDb } from "../src/db/client";

async function main() {
  const asOf = process.argv.find((a) => a.startsWith("--asOf="))?.slice(7);
  const result = await recomputeMutualFunds(asOf);
  console.log(JSON.stringify(result, null, 2));
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
