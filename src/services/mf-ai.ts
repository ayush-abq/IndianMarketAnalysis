import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getFundDetail } from "@/services/mf-queries";

export async function analyzeFund(id: number) {
  const detail = await getFundDetail(id);
  if (!detail) return null;
  const metrics = {
    scheme: detail.fund.schemeName,
    category: detail.fund.category,
    plan: detail.fund.plan,
    option: detail.fund.option,
    score: detail.score?.overallScore ?? null,
    classification: detail.score?.classification ?? null,
    signal: detail.score?.signal ?? null,
    return1y: detail.returns?.return1y ?? null,
    cagr3y: detail.returns?.cagr3y ?? null,
    cagr5y: detail.returns?.cagr5y ?? null,
    sharpe: detail.risk?.sharpe ?? null,
    sortino: detail.risk?.sortino ?? null,
    maxDrawdown: detail.risk?.maxDrawdown ?? null,
    currentDrawdown: detail.risk?.currentDrawdown ?? null,
    expense: detail.expense?.expenseRatio ?? null,
    aum: detail.aum?.aum ?? null,
    consistency: detail.score?.consistencyScore ?? null,
    sectors: detail.sectors,
    researchNote: detail.score?.researchNote ?? "",
    explanation: detail.score?.explanation ?? null,
  };

  const deterministic = {
    source: "deterministic",
    whyRanks: metrics.researchNote,
    whatItDoesWell: [
      metrics.sharpe != null ? `Sharpe ${metrics.sharpe}` : null,
      metrics.cagr5y != null ? `5Y CAGR ${metrics.cagr5y}` : null,
      metrics.consistency != null ? `Consistency score ${metrics.consistency}` : null,
    ]
      .filter(Boolean)
      .join("; ") || "See scorecard. Missing fields are not invented.",
    mainRisks:
      Number(metrics.maxDrawdown ?? 0) <= -30
        ? `Large historical drawdown ${metrics.maxDrawdown}.`
        : "See drawdown and sector context. History can deteriorate.",
    benchmark: "Official category/benchmark excess is shown only when both series exist in the database.",
    drawdownHistory: `Max drawdown ${metrics.maxDrawdown ?? "insufficient history"}; current ${metrics.currentDrawdown ?? "n/a"}.`,
    portfolioConcentration: detail.portfolio
      ? `Top 10 ${detail.portfolio.top10Percent ?? "n/a"}%. Holdings date ${detail.portfolio.date}.`
      : "Official monthly holdings are not in the daily AMFI NAV file.",
    sectorExposure: detail.sectors.map((s) => `${s.nseName} ${s.weight}% (${s.source})`).join("; ") || "Unavailable",
    sectorContext: detail.sectors
      .map((s) => `${s.sectorName}: drawdown ${s.drawdown ?? "n/a"}, recovery ${s.recoveryScore ?? "n/a"}, ${s.signal ?? ""}`)
      .join("; "),
    whatCouldDeteriorate:
      "Weaker rolling-period hit rate versus benchmark, a manager/strategy change, TER increase, or a shift of underlying sectors into falling-knife territory would lower the research rank.",
    language: "Research candidate / strong historical profile / high risk / potentially suitable for further research. Not a buy recommendation.",
    metrics,
  };

  if (!env().AI_ANALYSIS_ENABLED || !env().OPENAI_API_KEY) return deterministic;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env().OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env().OPENAI_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a mutual-fund research assistant. Use ONLY the supplied JSON. Never invent NAV, returns, AUM, TER, holdings, or risk numbers. Never say buy/sell. Use research-candidate language. Return JSON keys: whyRanks, whatItDoesWell, mainRisks, benchmark, drawdownHistory, portfolioConcentration, sectorExposure, sectorContext, whatCouldDeteriorate.",
          },
          { role: "user", content: JSON.stringify(metrics) },
        ],
      }),
    });
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content.replace(/^```json|```$/g, "").trim());
    return { source: "ai", ...parsed, metrics };
  } catch (err) {
    logger.error({ err }, "MF AI analysis failed — deterministic note");
    return deterministic;
  }
}
