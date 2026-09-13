import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_PORT: z.coerce.number().default(3000),
  APP_TZ: z.string().default("Asia/Kolkata"),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z
    .string()
    .default("postgres://scanner:scanner@localhost:5432/sector_scanner"),

  /**
   * Primary market-data source. The app never scrapes unofficial NSE APIs.
   * NSE_OFFICIAL_EOD — official published daily index close files
   * LICENSED         — authorized NSE / vendor REST API (credentials required)
   * CSV_IMPORT       — emergency folder of official CSVs
   */
  DATA_PROVIDER: z
    .enum(["NSE_OFFICIAL_EOD", "LICENSED", "CSV_IMPORT", "YAHOO"])
    .default("NSE_OFFICIAL_EOD"),
  FALLBACK_PROVIDER: z
    .enum(["LICENSED", "YAHOO", "CSV_IMPORT", "NONE"])
    .default("NONE"),

  NSE_DATA_MODE: z.string().default("EOD"),
  NSE_API_KEY: z.string().optional().default(""),
  NSE_API_SECRET: z.string().optional().default(""),
  NSE_BASE_URL: z.string().default(""),
  NSE_OFFICIAL_EOD_BASE_URL: z
    .string()
    .default("https://nsearchives.nseindia.com/content/indices"),
  NSE_BHAV_BASE_URL: z
    .string()
    .default("https://nsearchives.nseindia.com/products/content"),
  NSE_CONSTITUENT_BASE_URL: z
    .string()
    .default("https://nsearchives.nseindia.com/content/indices"),
  STOCK_BHAV_CRON: z.string().default("45 18 * * 1-5"),
  STOCK_HISTORICAL_START: z.string().default("2020-01-01"),
  NSE_BHAV_HISTORICAL_BASE_URL: z
    .string()
    .default("https://nsearchives.nseindia.com/content/historical/EQUITIES"),
  NSE_PR_BASE_URL: z
    .string()
    .default("https://nsearchives.nseindia.com/archives/equities/bhavcopy/pr"),
  NSE_HISTORICAL_START: z.string().default("2015-01-01"),
  CSV_IMPORT_DIR: z.string().default("./data/imports"),
  YAHOO_BASE_URL: z.string().default("https://query1.finance.yahoo.com"),
  PROVIDER_MIN_INTERVAL_MS: z.coerce.number().default(1500),
  PROVIDER_MAX_RETRIES: z.coerce.number().default(5),

  SCHEDULER_CRON: z.string().default("30 18 * * 1-5"),
  SCHEDULER_TZ: z.string().default("Asia/Kolkata"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  AI_ANALYSIS_ENABLED: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),
  LOCAL_AI_ENABLED: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),
  OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
  AI_MODEL_ANALYST: z.string().optional().default(""),
  AI_MODEL_REASONER: z.string().optional().default(""),
  AI_MODEL_FAST: z.string().optional().default(""),
  AI_MODEL_EMBEDDING: z.string().optional().default(""),
  ADMIN_USER: z.string().optional().default(""),
  ADMIN_PASSWORD: z.string().optional().default(""),
  HISTORICAL_LOOKBACK_YEARS: z.string().default("max"),
  ATH_METHODOLOGY: z.enum(["closing", "intraday"]).default("closing"),

  MF_PROVIDER: z.enum(["AMFI", "LICENSED"]).default("AMFI"),
  AMFI_NAVALL_URL: z.string().default("https://www.amfiindia.com/spages/NAVAll.txt"),
  AMFI_NAV_HISTORY_URL: z
    .string()
    .default("https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx"),
  MF_LICENSED_BASE_URL: z.string().optional().default(""),
  MF_API_KEY: z.string().optional().default(""),
  MF_HISTORICAL_START: z.string().default("2018-01-01"),
  MF_NAV_CRON: z.string().default("0 22 * * 1-6"),
});

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | null = null;

export function env(): AppEnv {
  if (cached) return cached;
  cached = schema.parse(process.env);
  return cached;
}

export function resetEnvCache() {
  cached = null;
}
