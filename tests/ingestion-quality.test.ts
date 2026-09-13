import { describe, expect, it } from "vitest";
import { validateBars } from "@/services/data-quality";
import { jobKeyFor } from "@/services/ingestion-key";
import type { PriceBar } from "@/calculations/trading-days";

describe("Data quality", () => {
  it("flags null closes, duplicates, and invalid OHLC", () => {
    const bars: PriceBar[] = [
      { date: "2024-01-02", open: 10, high: 12, low: 9, close: 11 },
      { date: "2024-01-02", open: 10, high: 12, low: 9, close: 11 },
      { date: "2024-01-03", open: 10, high: 8, low: 9, close: 11 },
      { date: "2024-01-04", open: 10, high: 12, low: 9, close: Number.NaN },
    ];
    const flags = validateBars(1, bars);
    expect(flags.some((f) => f.flag === "DUPLICATE")).toBe(true);
    expect(flags.some((f) => f.flag === "INVALID_OHLC")).toBe(true);
    expect(flags.some((f) => f.flag === "NULL_VALUE")).toBe(true);
  });

  it("flags abnormal jumps", () => {
    const bars: PriceBar[] = [
      { date: "2024-01-02", close: 100, open: 100, high: 100, low: 100 },
      { date: "2024-01-03", close: 180, open: 180, high: 180, low: 180 },
    ];
    const flags = validateBars(1, bars);
    expect(flags.some((f) => f.flag === "ABNORMAL_JUMP")).toBe(true);
  });
});

describe("Idempotent ingestion", () => {
  it("uses a stable job key per trading date + mode", () => {
    expect(jobKeyFor("2026-09-11", "daily")).toBe("ingest:daily:2026-09-11");
    expect(jobKeyFor("2026-09-11", "backfill")).toBe("ingest:backfill:2026-09-11");
  });
});
