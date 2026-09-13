import { sipFutureValue, taxCategoryInfo, diversificationScore, overlapHoldings } from "@/mf/calculations";
import { getFundDetail, loadFundRows, loadNavSeries, overlapForFunds, type MfRow } from "@/services/mf-queries";

export async function researchShortlist(input: {
  amount?: number;
  monthlySip?: number;
  horizon?: string;
  riskTolerance?: string;
  categories?: string[];
  plan?: string;
  option?: string;
}) {
  const plan = input.plan ?? "DIRECT";
  const option = input.option ?? "GROWTH";
  let rows = await loadFundRows({
    plan,
    option,
    horizon: input.horizon,
    riskProfile: input.riskTolerance,
  });
  if (input.categories?.length) {
    rows = rows.filter((r) =>
      input.categories!.some((c) => r.category.toLowerCase().includes(c.toLowerCase()) || r.assetClass.toLowerCase().includes(c.toLowerCase())),
    );
  }
  const buckets = {
    largeCap: pick(rows, (r) => /large cap/i.test(r.category) && !/mid|small/i.test(r.category), 5),
    flexiCap: pick(rows, (r) => /flexi/i.test(r.category), 5),
    midCap: pick(rows, (r) => /mid cap/i.test(r.category) && !/large/i.test(r.category), 5),
    smallCap: pick(rows, (r) => /small cap/i.test(r.category), 5),
    hybrid: pick(rows, (r) => r.assetClass === "Hybrid", 5),
    debt: pick(rows, (r) => r.assetClass === "Debt", 5),
    index: pick(rows, (r) => r.assetClass === "Index Fund" || r.assetClass === "ETF", 5),
  };
  return {
    disclaimer:
      "Research shortlist only. Not personalized financial advice, not a recommendation to buy or sell, and not a guarantee of future returns.",
    inputs: input,
    defaultScreen: { plan, option },
    candidates: Object.entries(buckets).flatMap(([bucket, funds]) =>
      funds.map((f) => ({
        bucket,
        fund: f,
        why: whyQualifies(f, bucket, input.horizon),
        risks: risksFor(f),
      })),
    ),
  };
}

function pick(rows: MfRow[], pred: (r: MfRow) => boolean, n: number) {
  return rows.filter(pred).slice(0, n);
}

function whyQualifies(f: MfRow, bucket: string, horizon?: string) {
  const bits = [
    `Category-relative research screen: ${bucket.replace(/([A-Z])/g, " $1").trim()}.`,
    f.overallScore != null ? `Research score ${f.overallScore.toFixed(1)} (${(f.classification ?? "unclassified").replaceAll("_", " ")}).` : "Score pending more history.",
    f.cagr5y != null ? `5Y CAGR ${f.cagr5y.toFixed(1)}% (history, not a forecast).` : "5Y CAGR insufficient history.",
    f.sip5y != null ? `5Y SIP XIRR ${f.sip5y.toFixed(1)}%.` : null,
    f.sharpe != null ? `Sharpe ${f.sharpe.toFixed(2)}.` : null,
    f.maxDrawdown != null ? `Max drawdown ${f.maxDrawdown.toFixed(1)}%.` : null,
    horizon ? `Horizon filter applied: ${horizon}.` : null,
    f.researchNote,
  ];
  return bits.filter(Boolean).join(" ");
}

function risksFor(f: MfRow) {
  const risks = [];
  if ((f.maxDrawdown ?? 0) <= -30) risks.push("Historically large peak-to-trough drawdown.");
  if ((f.currentDrawdown ?? 0) >= 15) risks.push("Currently below a prior NAV peak.");
  if (f.signal === "FALLING_KNIFE") risks.push("Underlying sector context is still deteriorating.");
  if (f.expenseRatio != null && f.expenseRatio > 1.5) risks.push("Expense ratio is high versus typical direct-plan equity TERs.");
  if (f.assetClass === "Equity" && (f.category.toLowerCase().includes("small") || f.category.toLowerCase().includes("sectoral"))) {
    risks.push("Category has structurally higher volatility.");
  }
  if (!risks.length) risks.push("See fund detail for drawdown, concentration, and sector context. History can deteriorate.");
  return risks;
}

export function sipGoalScenarios(monthly: number, years: number) {
  return {
    disclaimer: "Scenarios use assumed annual rates. Not guaranteed. Markets can return less, including loss of capital.",
    monthly,
    years,
    scenarios: [8, 10, 12, 14].map((rate) => sipFutureValue(monthly, rate, years)),
  };
}

export async function fundTaxBlock(id: number) {
  const detail = await getFundDetail(id);
  if (!detail) return null;
  return {
    ...taxCategoryInfo(detail.fund.assetClass, detail.fund.category),
    exitLoad: detail.expense?.exitLoad ?? null,
    asOf: detail.fresh?.terUpdated ?? detail.fresh?.navUpdated ?? null,
  };
}

export async function builtPortfolio(legs: { id: number; weight: number }[]) {
  const total = legs.reduce((a, l) => a + l.weight, 0);
  if (!total) return { error: "Weights must sum to a positive number" };
  const norm = legs.map((l) => ({ id: l.id, weight: (l.weight / total) * 100 }));
  const rows = await loadFundRows();
  const selected = norm.map((l) => ({ ...l, fund: rows.find((r) => r.id === l.id) ?? null }));
  const overlap = norm.length >= 2 ? await overlapForFunds(norm.map((l) => l.id)) : { overlapPct: null, common: [], note: "Need at least two funds" };
  const series = [];
  for (const l of norm) {
    const navs = await loadNavSeries(l.id);
    series.push({
      id: l.id,
      weight: l.weight,
      navs: navs.map((n) => ({ date: n.date, nav: Number(n.nav) })),
    });
  }
  const history = combinePortfolioNav(series);
  const wExp = weighted(selected, (f) => f?.expenseRatio ?? null);
  const wScore = weighted(selected, (f) => f?.overallScore ?? null);
  const wDd = weighted(selected, (f) => f?.maxDrawdown ?? null);
  const wVol = history.vol;
  const assetClasses = new Set(selected.map((s) => s.fund?.assetClass).filter(Boolean));
  const div = diversificationScore({
    pairwiseOverlap: overlap.overlapPct ?? null,
    sectorHhi: null,
    assetClassCount: assetClasses.size,
    geographicCount: selected.some((s) => /international|overseas|global/i.test(s.fund?.category ?? "")) ? 2 : 1,
  });
  return {
    disclaimer: "Hypothetical blended research portfolio. Not advice. Overlap uses official holdings only when present.",
    legs: selected,
    overlap,
    overlapWarning:
      overlap.overlapPct != null && overlap.overlapPct >= 40
        ? `High overlap: common stock exposure about ${overlap.overlapPct.toFixed(0)}%.`
        : null,
    weightedExpense: wExp,
    weightedScore: wScore,
    weightedMaxDrawdown: wDd,
    historicalVol: wVol,
    historicalCagr3y: history.cagr3y,
    diversificationScore: div,
  };
}

function weighted(selected: { weight: number; fund: MfRow | null }[], pick: (f: MfRow | null) => number | null) {
  let acc = 0;
  let w = 0;
  for (const s of selected) {
    const v = pick(s.fund);
    if (v == null) continue;
    acc += v * s.weight;
    w += s.weight;
  }
  return w ? acc / w : null;
}

function combinePortfolioNav(
  series: { id: number; weight: number; navs: { date: string; nav: number }[] }[],
) {
  if (!series.length || series.some((s) => s.navs.length < 10)) {
    return { vol: null as number | null, cagr3y: null as number | null };
  }
  const dates = new Set<string>();
  for (const s of series) for (const n of s.navs) dates.add(n.date);
  const ordered = [...dates].sort();
  const maps = series.map((s) => new Map(s.navs.map((n) => [n.date, n.nav])));
  const values: number[] = [];
  let last = 100;
  const startIdx = ordered.findIndex((d) => maps.every((m) => m.has(d)));
  if (startIdx < 0) return { vol: null, cagr3y: null };
  const startDate = ordered[startIdx];
  const startNavs = maps.map((m) => m.get(startDate)!);
  for (const d of ordered.slice(startIdx)) {
    let v = 0;
    let ok = true;
    for (let i = 0; i < maps.length; i++) {
      const nav = maps[i].get(d);
      if (nav == null) {
        ok = false;
        break;
      }
      v += (nav / startNavs[i]) * (series[i].weight / 100) * 100;
    }
    if (ok) {
      values.push(v);
      last = v;
    }
  }
  if (values.length < 12) return { vol: null, cagr3y: null };
  const rets = [];
  for (let i = 1; i < values.length; i++) rets.push(values[i] / values[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varc = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  const vol = Math.sqrt(varc) * Math.sqrt(252) * 100;
  const years = values.length / 252;
  const cagr3y = years >= 2.5 ? ((last / 100) ** (1 / years) - 1) * 100 : null;
  return { vol, cagr3y };
}

export { overlapHoldings };
