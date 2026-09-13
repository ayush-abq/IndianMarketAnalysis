import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, type AppSettings } from "@/config/defaults";
import { getDb } from "@/db/client";
import { appSettings } from "@/db/schema";

const KEY = "scanner";

export async function getSettings(): Promise<AppSettings> {
  const db = getDb();
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, KEY)).limit(1);
  if (!rows[0]) return structuredClone(DEFAULT_SETTINGS);
  return deepMerge(structuredClone(DEFAULT_SETTINGS), rows[0].value as Partial<AppSettings>);
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = deepMerge(current, patch);
  const db = getDb();
  await db
    .insert(appSettings)
    .values({ key: KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: next, updatedAt: new Date() },
    });
  return next;
}

export async function seedSettings() {
  const db = getDb();
  await db.insert(appSettings).values({ key: KEY, value: DEFAULT_SETTINGS }).onConflictDoNothing();
}

function deepMerge<T>(base: T, patch: Partial<T>): T {
  const out = { ...base } as T;
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      (out as Record<string, unknown>)[k] = deepMerge(
        (base as Record<string, unknown>)[k] ?? {},
        v as Record<string, unknown>,
      );
    } else if (v !== undefined) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
