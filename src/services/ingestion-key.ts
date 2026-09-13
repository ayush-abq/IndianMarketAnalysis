export function jobKeyFor(tradingDate: string, mode: "daily" | "backfill" | "manual"): string {
  return `ingest:${mode}:${tradingDate}`;
}
