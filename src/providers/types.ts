export type ReturnTypeCode = "PR" | "TR";

export type ProviderIndex = {
  name: string;
  symbol: string;
  nseName: string;
  category?: string;
  subCategory?: string;
  yahooSymbol?: string;
  inceptionDate?: string | null;
  description?: string;
  hasTotalReturn?: boolean;
};

export type ProviderBar = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
  returnType: ReturnTypeCode;
};

export type ProviderMetadata = {
  name: string;
  nseName: string;
  inceptionDate?: string | null;
  description?: string;
};

export type ProviderConstituent = {
  symbol: string;
  name?: string;
  weight?: number | null;
  marketCap?: number | null;
};

export type HistoryRequest = {
  nseName: string;
  symbol: string;
  yahooSymbol?: string | null;
  from: string;
  to: string;
  returnType: ReturnTypeCode;
};

export interface MarketDataProvider {
  readonly id: string;
  readonly kind: "official" | "licensed" | "import" | "third_party";
  readonly description: string;
  getIndexList(): Promise<ProviderIndex[]>;
  getHistoricalIndexData(req: HistoryRequest): Promise<ProviderBar[]>;
  getLatestIndexData(req: Omit<HistoryRequest, "from">): Promise<ProviderBar | null>;
  getIndexMetadata(nseName: string): Promise<ProviderMetadata | null>;
  getIndexConstituents(nseName: string, asOf?: string): Promise<ProviderConstituent[]>;
  getTotalReturnData(req: Omit<HistoryRequest, "returnType">): Promise<ProviderBar[]>;
  healthcheck(): Promise<{ ok: boolean; message: string }>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
