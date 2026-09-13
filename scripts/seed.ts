import { ensureUniverse } from "../src/services/ingestion";
import { seedHolidays } from "../src/services/calendar";
import { seedSettings } from "../src/services/settings";
import { closeDb } from "../src/db/client";

async function main() {
  await seedSettings();
  await seedHolidays();
  await ensureUniverse();
  await closeDb();
  console.log("Seed complete: universe, holidays, settings");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
