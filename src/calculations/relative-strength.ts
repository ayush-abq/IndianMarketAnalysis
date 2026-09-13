export function relativePerformance(
  sectorReturn: number | null,
  benchmarkReturn: number | null,
): number | null {
  if (sectorReturn == null || benchmarkReturn == null) return null;
  return sectorReturn - benchmarkReturn;
}

export function relativeStrengthBundle(sector: {
  m1: number | null;
  m3: number | null;
  m6: number | null;
  y1: number | null;
}, nifty50: {
  m1: number | null;
  m3: number | null;
  m6: number | null;
  y1: number | null;
}, nifty500: {
  m1: number | null;
  m3: number | null;
  m6: number | null;
  y1: number | null;
}) {
  return {
    vs50: {
      m1: relativePerformance(sector.m1, nifty50.m1),
      m3: relativePerformance(sector.m3, nifty50.m3),
      m6: relativePerformance(sector.m6, nifty50.m6),
      y1: relativePerformance(sector.y1, nifty50.y1),
    },
    vs500: {
      m1: relativePerformance(sector.m1, nifty500.m1),
      m3: relativePerformance(sector.m3, nifty500.m3),
      m6: relativePerformance(sector.m6, nifty500.m6),
      y1: relativePerformance(sector.y1, nifty500.y1),
    },
  };
}
