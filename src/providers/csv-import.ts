import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { INDEX_UNIVERSE } from "@/config/universe";
import { logger } from "@/lib/logger";
import { normalizeIndexName, parseOfficialIndexCloseCsv, rowsToBars } from "./nse-csv";
import type {
  HistoryRequest,
  MarketDataProvider,
  ProviderBar,
  ProviderConstituent,
  ProviderIndex,
  ProviderMetadata,
} from "./types";

/**
 * Emergency import of official NSE / NSE Indices CSV files.
 * Not part of the daily workflow.
 */
export class CsvImportProvider implements MarketDataProvider {
  readonly id = "CSV_IMPORT";
  readonly kind = "import" as const;
  readonly description = "Emergency import of official NSE/Nifty CSV files";

  async getIndexList(): Promise<ProviderIndex[]> {
    return INDEX_UNIVERSE.map((i) => ({
      name: i.name,
      symbol: i.symbol,
      nseName: i.nseName,
      category: i.category,
      subCategory: i.subCategory,
      description: i.description,
    }));
  }

  async getHistoricalIndexData(req: HistoryRequest): Promise<ProviderBar[]> {
    const rows = await this.loadAll();
    return rowsToBars(rows, req.nseName, req.returnType).filter(
      (b) => b.date >= req.from && b.date <= req.to,
    );
  }

  async getLatestIndexData(req: Omit<HistoryRequest, "from">): Promise<ProviderBar | null> {
    const bars = await this.getHistoricalIndexData({ ...req, from: "1900-01-01" });
    return bars.at(-1) ?? null;
  }

  async getIndexMetadata(nseName: string): Promise<ProviderMetadata | null> {
    const seed = INDEX_UNIVERSE.find((i) => normalizeIndexName(i.nseName) === normalizeIndexName(nseName));
    return seed
      ? { name: seed.name, nseName: seed.nseName, description: seed.description }
      : { name: nseName, nseName };
  }

  async getIndexConstituents(): Promise<ProviderConstituent[]> {
    return [];
  }

  async getTotalReturnData(req: Omit<HistoryRequest, "returnType">): Promise<ProviderBar[]> {
    const bars = await this.getHistoricalIndexData({ ...req, returnType: "TR" });
    return bars.filter((b) => b.returnType === "TR");
  }

  async healthcheck() {
    try {
      const files = await this.listFiles();
      return { ok: files.length > 0, message: `${files.length} official CSV file(s) in import directory` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Import directory unreadable" };
    }
  }

  private async listFiles(): Promise<string[]> {
    const dir = path.resolve(env().CSV_IMPORT_DIR);
    const entries = await readdir(dir).catch(() => []);
    return entries.filter((f) => f.toLowerCase().endsWith(".csv")).map((f) => path.join(dir, f));
  }

  private async loadAll() {
    const files = await this.listFiles();
    const rows = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      const parsed = parseOfficialIndexCloseCsv(text);
      logger.info({ file, rows: parsed.length }, "Imported official CSV");
      rows.push(...parsed);
    }
    return rows;
  }
}
