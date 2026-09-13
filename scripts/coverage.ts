import { buildCoverageReport, fillStockSectorsFromIndustry } from "../src/services/coverage";
import { closeDb } from "../src/db/client";

async function main() {
  const filled = await fillStockSectorsFromIndustry();
  const report = await buildCoverageReport();
  console.log(JSON.stringify({ filledSectors: filled, ...report }, null, 2));
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
