import { recomputeAll } from "../src/services/metrics";
import { writeDailySnapshots } from "../src/services/snapshots";
import { generateDailyAlerts } from "../src/services/alerts";
import { generateDailyReport } from "../src/services/report";
import { closeDb } from "../src/db/client";
import { mergeAliasedHistories } from "../src/services/ingestion";

async function main() {
  await mergeAliasedHistories();
  const result = await recomputeAll(undefined, "PR");
  if (result.asOf) {
    await writeDailySnapshots(result.asOf);
    await generateDailyAlerts(result.asOf);
    await generateDailyReport(result.asOf);
  }
  console.log(result);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
