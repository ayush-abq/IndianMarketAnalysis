import { loadScannerRows, latestMetricDate } from "@/services/queries";
import { loadFundRows } from "@/services/mf-queries";
import { loadStockRows } from "@/services/stock-metrics";
import { latestMarketContext } from "@/services/market-context";
import { whyOpportunity } from "@/scoring/stock-opportunity";
import { classifyOpportunity } from "@/scoring/opportunity-classify";
import { MODEL_VERSIONS } from "@/config/terminal-defaults";
import { ALPHA_MODEL, RESEARCH_MODES, type ResearchMode } from "@/config/alpha-defaults";
import { confluenceScore, aggressiveAlphaScore, riskPenalty, netAggressiveScore, passesModeGates, situationalRisk } from "@/scoring/confluence";
import { recoveryStage, RECOVERY_STAGE_LABEL, falseRecoveryRisk, fallenAngelScore } from "@/scoring/recovery-stage";
import { capitalPreservationWarning } from "@/services/alpha-research";

export type RadarItem = {
  type: "SECTOR" | "STOCK" | "FUND";
  id: number;
  name: string;
  sector: string | null;
  price: number | null;
  drawdown: number | null;
  return1y: number | null;
  cagr3y: number | null;
  cagr5y: number | null;
  quality: number | null;
  valuation: number | null;
  earnings: number | null;
  momentum: number | null;
  recovery: number | null;
  relativeStrength: number | null;
  risk: number | null;
  opportunity: number | null;
  classification: string;
  why: string[];
  risks: string[];
  href: string;
  confluence?: number | null;
  aggressiveAlpha?: number | null;
  riskPenalty?: number | null;
  netAggressive?: number | null;
  recoveryStage?: number | null;
  recoveryStageLabel?: string | null;
  falseRecovery?: boolean;
  fallenAngel?: number | null;
  missing?: string[];
};

function take<T>(rows: T[], n = 10) {
  return rows.slice(0, n);
}

function enrich(item: RadarItem): RadarItem {
  const mom = item.momentum != null ? Math.max(0, Math.min(100, 50 + item.momentum)) : null;
  const rs = item.relativeStrength != null ? Math.max(0, Math.min(100, 50 + item.relativeStrength)) : item.relativeStrength;
  const conf = confluenceScore({
    fundamentals: item.quality,
    valuation: item.valuation,
    earnings: item.earnings,
    momentum: mom,
    relativeStrength: rs,
    sector: item.recovery,
    recovery: item.recovery,
  });
  const upside = item.drawdown != null ? Math.max(0, Math.min(100, item.drawdown)) : null;
  const agg = aggressiveAlphaScore({
    upside,
    valuationDislocation: item.valuation,
    earningsAcceleration: item.earnings,
    recovery: item.recovery,
    relativeStrength: rs,
    sector: item.recovery,
  });
  const pen = riskPenalty({
    drawdown: situationalRisk(item.drawdown),
    deterioration: item.classification === "VALUE_TRAP" || item.classification === "FALLING_KNIFE" ? 80 : 20,
    liquidity: null,
    debt: null,
    event: null,
    volatility: item.risk != null ? Math.min(100, Math.abs(item.risk)) : null,
  });
  const net = netAggressiveScore(agg.score, pen.score);
  const stage = recoveryStage({
    drawdown: item.drawdown,
    return1m: item.momentum,
    return3m: null,
    vs200: null,
    recovery: item.recovery,
    rs: item.relativeStrength,
  });
  const fr = falseRecoveryRisk({
    return1m: item.momentum,
    recovery: item.recovery,
    vs200: null,
    earnings: item.earnings,
    quality: item.quality,
    rs: item.relativeStrength,
  });
  return {
    ...item,
    confluence: conf.score,
    aggressiveAlpha: agg.score,
    riskPenalty: pen.score,
    netAggressive: net.net,
    recoveryStage: stage,
    recoveryStageLabel: RECOVERY_STAGE_LABEL[stage],
    falseRecovery: fr.flag,
    fallenAngel: fallenAngelScore({
      drawdown: item.drawdown,
      quality: item.quality,
      earnings: item.earnings,
      recovery: item.recovery,
      vs200: null,
    }),
    missing: conf.missing,
    risks: fr.flag ? [...item.risks, "FALSE RECOVERY RISK: " + fr.reasons.join(" ")] : item.risks,
  };
}

export async function buildOpportunityRadar(mode: ResearchMode = "BALANCED") {
  const asOf = await latestMetricDate("PR");
  const sectors = await loadScannerRows({ returnType: "PR" });
  const funds = await loadFundRows({ plan: "DIRECT", option: "GROWTH" }).catch(() => []);
  const stocks = await loadStockRows().catch(() => []);
  const regime = await latestMarketContext().catch(() => null);

  const sectorItems: RadarItem[] = sectors
    .filter((s) => !s.isBenchmark)
    .map((s) => {
      const classification = classifyOpportunity({
        drawdown: s.distanceFromAth,
        quality: null,
        valuation: null,
        earnings: null,
        recovery: s.recoveryScore,
        rs: s.rs1yNifty50,
        vs200: s.priceVs200,
        return1m: s.return1m,
        return3m: s.return3m,
      });
      const why = whyOpportunity({
        sectorRecovery: s.recoveryScore,
        relativeStrength: s.rs1yNifty50 != null ? Math.max(0, Math.min(100, 50 + s.rs1yNifty50)) : null,
        momentum: s.return1m != null ? Math.max(0, Math.min(100, 50 + s.return1m)) : null,
      });
      return {
        type: "SECTOR" as const,
        id: s.indexId,
        name: s.name,
        sector: s.category,
        price: s.current,
        drawdown: s.distanceFromAth,
        return1y: s.return1y,
        cagr3y: s.return3y,
        cagr5y: s.return5y,
        quality: null,
        valuation: null,
        earnings: null,
        momentum: s.return1m,
        recovery: s.recoveryScore,
        relativeStrength: s.rs1yNifty50,
        risk: s.weaknessScore,
        opportunity: s.opportunityScore,
        classification,
        why: why.reasons,
        risks: why.risks,
        href: `/indices/${s.indexId}`,
      };
    });

  const fundItems: RadarItem[] = funds.map((f) => ({
    type: "FUND" as const,
    id: f.id,
    name: f.schemeName,
    sector: f.category,
    price: f.nav,
    drawdown: f.currentDrawdown,
    return1y: f.return1y,
    cagr3y: f.cagr3y,
    cagr5y: f.cagr5y,
    quality: f.consistency,
    valuation: f.expenseRatio != null ? Math.max(0, 100 - f.expenseRatio * 40) : null,
    earnings: null,
    momentum: f.return1y,
    recovery: f.overallScore,
    relativeStrength: null,
    risk: f.maxDrawdown,
    opportunity: f.overallScore,
    classification: f.classification ?? f.signal ?? "WATCHLIST",
    why: [
      f.overallScore != null ? `Fund research score ${f.overallScore.toFixed(0)}` : "Score pending more history.",
      f.cagr5y != null ? `5Y CAGR ${f.cagr5y.toFixed(1)}% (history, not a forecast).` : "5Y CAGR N/A.",
    ],
    risks: [
      f.maxDrawdown != null ? `Max historical drawdown ${f.maxDrawdown.toFixed(1)}%.` : "Drawdown history incomplete.",
      "Fund score is not a buy recommendation.",
    ],
    href: `/mutual-funds/${f.id}`,
  }));

  const stockItems: RadarItem[] = stocks.map((s) => ({
    type: "STOCK" as const,
    id: s.id,
    name: `${s.symbol}${s.companyName ? ` · ${s.companyName}` : ""}`,
    sector: s.sector,
    price: s.close,
    drawdown: s.distanceFromAth,
    return1y: s.return1y,
    cagr3y: s.return3y,
    cagr5y: s.return5y,
    quality: s.qualityScore,
    valuation: s.valuationScore,
    earnings: s.earningsScore,
    momentum: s.return1m,
    recovery: null,
    relativeStrength: s.rsScore,
    risk: s.dataQualityScore,
    opportunity: s.opportunityScore,
    classification: s.classification ?? "WATCHLIST",
    why: (s.explanation as { why?: { reasons?: string[] } } | null)?.why?.reasons ?? [
      "Price/ATH research only until licensed fundamentals are configured.",
    ],
    risks: (s.explanation as { why?: { risks?: string[] } } | null)?.why?.risks ?? [
      "Quality, valuation and earnings are N/A.",
    ],
    href: `/stocks/${s.id}`,
  }));

  const sectorEnriched = sectorItems.map(enrich);
  const fundEnriched = fundItems.map(enrich);
  const stockEnriched = stockItems.map(enrich);
  const gate = (rows: RadarItem[]) =>
    rows.filter((r) =>
      passesModeGates(mode, {
        drawdown: r.type === "FUND" ? Math.max(r.drawdown ?? 0, RESEARCH_MODES[mode].minDrawdown) : r.drawdown,
        recovery: r.recovery,
        classification: r.classification,
        dataQuality: r.type === "STOCK" ? r.risk : 70,
      }),
    );

  const byOpp = (a: RadarItem, b: RadarItem) =>
    mode === "AGGRESSIVE"
      ? (b.netAggressive ?? b.confluence ?? b.opportunity ?? -1) - (a.netAggressive ?? a.confluence ?? a.opportunity ?? -1)
      : (b.confluence ?? b.opportunity ?? -1) - (a.confluence ?? a.opportunity ?? -1);
  const beaten = (rows: RadarItem[]) =>
    [...rows].filter((r) => (r.drawdown ?? 0) >= 30).sort((a, b) => (b.drawdown ?? 0) - (a.drawdown ?? 0));
  const recovery = (rows: RadarItem[]) =>
    [...rows]
      .filter((r) => r.classification === "EARLY_RECOVERY" || r.classification === "CONFIRMED_RECOVERY" || (r.recovery ?? 0) >= 55)
      .sort((a, b) => (b.recovery ?? 0) - (a.recovery ?? 0));
  const qarp = (rows: RadarItem[]) =>
    [...rows]
      .filter((r) => (r.quality ?? 0) >= 60 && (r.valuation ?? 0) >= 55)
      .sort(byOpp);
  const knives = (rows: RadarItem[]) => rows.filter((r) => r.classification === "FALLING_KNIFE" || r.classification === "STRUCTURAL_WEAKNESS");
  const traps = (rows: RadarItem[]) => rows.filter((r) => r.classification === "VALUE_TRAP");
  const rs = (rows: RadarItem[]) =>
    [...rows].filter((r) => r.relativeStrength != null).sort((a, b) => (b.relativeStrength ?? 0) - (a.relativeStrength ?? 0));
  const earnings = (rows: RadarItem[]) =>
    [...rows].filter((r) => r.earnings != null).sort((a, b) => (b.earnings ?? 0) - (a.earnings ?? 0));

  return {
    asOf,
    modelVersion: MODEL_VERSIONS.opportunity,
    disclaimer:
      "Research classifications only. Not buy/sell advice. Missing fundamentals stay N/A. Historical returns are not forecasts.",
    regime: regime
      ? {
          date: "date" in regime ? regime.date : null,
          regime: "regime" in regime ? regime.regime : null,
          score: "score" in regime ? Number(regime.score) : null,
          explanation: "explanation" in regime ? regime.explanation : null,
        }
      : null,
    lists: {
      topSectors: take(gate([...sectorEnriched]).sort(byOpp)),
      topFunds: take(gate([...fundEnriched]).sort(byOpp)),
      topStocks: take(gate([...stockEnriched]).sort(byOpp)),
      qualityValue: take(qarp(gate([...stockEnriched, ...fundEnriched]))),
      earlyRecovery: take(recovery(gate([...sectorEnriched, ...stockEnriched, ...fundEnriched]))),
      beatenDown: take(beaten(gate([...sectorEnriched, ...stockEnriched]))),
      earningsAcceleration: take(earnings(stockEnriched)),
      relativeStrength: take(rs(gate([...sectorEnriched, ...stockEnriched]))),
      qarp: take(qarp(gate([...stockEnriched, ...fundEnriched]))),
      fallingKnives: take(knives([...sectorEnriched, ...stockEnriched, ...fundEnriched])),
      valueTraps: take(traps([...stockEnriched, ...fundEnriched])),
      deteriorating: take(
        [...sectorEnriched, ...stockEnriched, ...fundEnriched]
          .filter((r) => r.classification === "FALLING_KNIFE" || r.classification === "VALUE_TRAP" || r.classification === "STRUCTURAL_WEAKNESS")
          .sort((a, b) => (b.drawdown ?? 0) - (a.drawdown ?? 0)),
      ),
    },
    table: take(gate([...sectorEnriched, ...stockEnriched, ...fundEnriched]).sort(byOpp), 40),
    mode,
    modeSpec: RESEARCH_MODES[mode],
    alphaModel: ALPHA_MODEL,
    systemicWarning: capitalPreservationWarning(regime && "regime" in regime ? String(regime.regime) : null),
  };
}
