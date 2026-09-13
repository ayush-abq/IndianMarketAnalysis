export type ConstituentSnapshot = {
  symbol: string;
  distanceFromAth: number | null;
  above50dma: boolean | null;
  above200dma: boolean | null;
};

export function calculateBreadth(constituents: ConstituentSnapshot[]) {
  const n = constituents.length;
  if (!n) {
    return {
      constituentCount: 0,
      pctBelow10: null,
      pctBelow20: null,
      pctBelow30: null,
      pctBelow40: null,
      pctBelow50: null,
      pctAbove50dma: null,
      pctAbove200dma: null,
      breadthScore: null,
    };
  }

  const withAth = constituents.filter((c) => c.distanceFromAth != null);
  const pct = (threshold: number) =>
    withAth.length
      ? (withAth.filter((c) => (c.distanceFromAth ?? 0) >= threshold).length / withAth.length) * 100
      : null;

  const ma50 = constituents.filter((c) => c.above50dma != null);
  const ma200 = constituents.filter((c) => c.above200dma != null);
  const pctAbove50dma = ma50.length
    ? (ma50.filter((c) => c.above50dma).length / ma50.length) * 100
    : null;
  const pctAbove200dma = ma200.length
    ? (ma200.filter((c) => c.above200dma).length / ma200.length) * 100
    : null;

  const below40 = pct(40) ?? 0;
  const below20 = pct(20) ?? 0;
  const weakMa = pctAbove200dma == null ? 50 : 100 - pctAbove200dma;
  const breadthScore = Math.min(100, below40 * 0.5 + below20 * 0.3 + weakMa * 0.2);

  return {
    constituentCount: n,
    pctBelow10: pct(10),
    pctBelow20: pct(20),
    pctBelow30: pct(30),
    pctBelow40: pct(40),
    pctBelow50: pct(50),
    pctAbove50dma,
    pctAbove200dma,
    breadthScore,
  };
}
