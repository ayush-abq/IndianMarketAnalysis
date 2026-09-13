const EXCLUDED =
  /VIX|INVERSE|LEVERAGE|DIVIDEND POINTS|SHARIAH|QUALITY|MOMENTUM|ALPHA|LOW VOLATILITY|EQUAL WEIGHT|HIGH BETA|CORPORATE GROUP|TATA GROUP|USD|FUTURES|VALUE 20|CNX /i;

export function isSectorResearchIndex(input: {
  name: string;
  category: string;
  isBenchmark: boolean;
  nseName?: string;
}): boolean {
  if (input.isBenchmark) return false;
  const hay = `${input.name} ${input.nseName ?? ""}`;
  if (EXCLUDED.test(hay)) return false;
  return input.category === "sectoral";
}
