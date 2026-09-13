/** Map AMFI/SEBI category or holding sector labels onto NSE sectoral indices. */
export const SECTOR_NAME_MAP: Record<string, string> = {
  BANK: "NIFTY BANK",
  BANKING: "NIFTY BANK",
  "PRIVATE BANK": "NIFTY PRIVATE BANK",
  "PSU BANK": "NIFTY PSU BANK",
  FINANCIAL: "NIFTY FINANCIAL SERVICES",
  FINANCE: "NIFTY FINANCIAL SERVICES",
  NBFC: "NIFTY FINANCIAL SERVICES",
  IT: "NIFTY IT",
  TECHNOLOGY: "NIFTY IT",
  PHARMA: "NIFTY PHARMA",
  PHARMACEUTICAL: "NIFTY PHARMA",
  HEALTHCARE: "NIFTY HEALTHCARE",
  HOSPITAL: "NIFTY HOSPITALS",
  AUTO: "NIFTY AUTO",
  AUTOMOBILE: "NIFTY AUTO",
  METAL: "NIFTY METAL",
  METALS: "NIFTY METAL",
  FMCG: "NIFTY FMCG",
  CONSUMER: "NIFTY FMCG",
  REALTY: "NIFTY REALTY",
  "REAL ESTATE": "NIFTY REALTY",
  MEDIA: "NIFTY MEDIA",
  ENERGY: "NIFTY OIL & GAS",
  OIL: "NIFTY OIL & GAS",
  GAS: "NIFTY OIL & GAS",
  POWER: "NIFTY POWER",
  INFRA: "NIFTY INFRASTRUCTURE",
  INFRASTRUCTURE: "NIFTY INFRASTRUCTURE",
  CEMENT: "NIFTY CEMENT",
  CHEMICAL: "NIFTY CHEMICALS",
  CHEMICALS: "NIFTY CHEMICALS",
  TELECOM: "NIFTY TELECOMMUNICATIONS",
  RETAIL: "NIFTY RETAIL",
  INSURANCE: "NIFTY INSURANCE",
  CONSTRUCTION: "NIFTY CONSTRUCTION",
};

export function mapToNiftySector(label: string): string | null {
  const key = label.toUpperCase().replace(/[^A-Z0-9 &]/g, " ").replace(/\s+/g, " ").trim();
  if (SECTOR_NAME_MAP[key]) return SECTOR_NAME_MAP[key];
  for (const [token, nse] of Object.entries(SECTOR_NAME_MAP)) {
    if (key.includes(token)) return nse;
  }
  return null;
}

export function impliedSectorFromCategory(category: string, assetClass: string): { nseName: string; weight: number; source: "category" }[] {
  if (assetClass !== "Equity" && !/sectoral|thematic/i.test(category)) return [];
  const mapped = mapToNiftySector(category);
  if (!mapped) return [];
  return [{ nseName: mapped, weight: 100, source: "category" }];
}
