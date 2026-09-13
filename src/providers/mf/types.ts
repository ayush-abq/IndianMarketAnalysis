import type { AmfiSchemeRow } from "@/mf/amfi-parse";

export type MfHolding = {
  securityName: string;
  isin?: string | null;
  weight: number;
  sector?: string | null;
  marketCap?: string | null;
};

export interface MutualFundDataProvider {
  readonly id: string;
  readonly kind: "official" | "licensed" | "import";
  getSchemeUniverse(): Promise<AmfiSchemeRow[]>;
  getNavHistory(from: string, to: string): Promise<AmfiSchemeRow[]>;
  getPortfolio?(schemeCode: string): Promise<MfHolding[]>;
  getExpenseRatio?(schemeCode: string): Promise<{ date: string; ter: number } | null>;
  getAum?(schemeCode: string): Promise<{ date: string; aum: number } | null>;
  getBenchmark?(schemeCode: string): Promise<string | null>;
  getRiskometer?(schemeCode: string): Promise<string | null>;
  getFundManager?(schemeCode: string): Promise<{ name: string; tenureYears?: number } | null>;
  healthcheck(): Promise<{ ok: boolean; message: string }>;
}
