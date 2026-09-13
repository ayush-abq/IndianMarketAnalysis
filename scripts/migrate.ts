import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgres://scanner:scanner@localhost:5432/sector_scanner";

async function main() {
  const sql = postgres(url, { max: 1 });
  const dir = path.resolve("drizzle");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const ddl = await readFile(path.join(dir, file), "utf8");
    await sql.unsafe(ddl);
    console.log(`Applied ${file}`);
  }
  await sql.end();
  console.log("Migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
