/**
 * Licensed / official fundamental feed.
 * Daily AMFI and NSE EOD files do not include ROE, PE, or quarterly statements.
 * Until MF_LICENSED / a dedicated equity fundamental URL is configured, every
 * fundamental field is unavailable (N/A) — never invented.
 */

export type FundamentalSnapshot = {
  stockId: number;
  date: string;
  period: string;
  revenue: number | null;
  ebitda: number | null;
  pat: number | null;
  eps: number | null;
  ocf: number | null;
  fcf: number | null;
  pe: number | null;
  pb: number | null;
  evEbitda: number | null;
  roe: number | null;
  roce: number | null;
  debtEquity: number | null;
  source: string;
  sourceDate: string | null;
  consensusAvailable: boolean;
};

export async function fetchEquityFundamentals(_symbols: string[]): Promise<{
  rows: FundamentalSnapshot[];
  limitation: string;
}> {
  const base = process.env.EQUITY_FUNDAMENTAL_BASE_URL ?? "";
  const key = process.env.EQUITY_FUNDAMENTAL_API_KEY ?? "";
  if (!base || !key) {
    return {
      rows: [],
      limitation:
        "No licensed equity-fundamental provider configured (EQUITY_FUNDAMENTAL_BASE_URL + EQUITY_FUNDAMENTAL_API_KEY). Quality, valuation and earnings scores stay N/A.",
    };
  }
  return {
    rows: [],
    limitation:
      "Licensed fundamental endpoint is configured but no adapter is authorized for the current vendor contract. Fields remain N/A rather than estimated.",
  };
}
