import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
};

function getSql() {
  if (!globalForDb.sql) {
    globalForDb.sql = postgres(env().DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }
  return globalForDb.sql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export async function closeDb() {
  if (globalForDb.sql) {
    await globalForDb.sql.end({ timeout: 5 });
    globalForDb.sql = undefined;
  }
}
