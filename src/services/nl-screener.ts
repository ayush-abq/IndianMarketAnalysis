import { loadScannerRows } from "@/services/queries";
import { loadFundRows } from "@/services/mf-queries";
import { loadStockRows } from "@/services/stock-metrics";
import { matchesScreen, type ScreenConditions } from "@/services/strategy-lab";

export type NlFilter = {
  asset: "SECTOR" | "STOCK" | "FUND";
  conditions: ScreenConditions;
  extra: string[];
};

export function parseResearchQuery(q: string): NlFilter {
  const text = q.toLowerCase();
  const conditions: ScreenConditions = {};
  const extra: string[] = [];
  let asset: NlFilter["asset"] = "SECTOR";
  if (/fund|mutual|flexi|sip|nav/.test(text)) asset = "FUND";
  else if (/stock|company|equity|qarp/.test(text)) asset = "STOCK";

  const dd = text.match(/(\d+)\s*%?\s*(below|drawdown|ath)/);
  if (dd) conditions.minDrawdown = Number(dd[1]);
  else if (/beaten down|deeply/.test(text)) conditions.minDrawdown = 30;

  const quality = text.match(/quality\s*>\s*(\d+)/);
  if (quality) conditions.minQuality = Number(quality[1]);
  else if (/high-?quality|quality/.test(text) && asset !== "FUND") conditions.minQuality = 70;

  const val = text.match(/valuation\s*>\s*(\d+)/);
  if (val) conditions.minValuation = Number(val[1]);

  const rec = text.match(/recovery\s*>\s*(\d+)/);
  if (rec) conditions.minRecovery = Number(rec[1]);
  else if (/recovery candidate|recovering/.test(text)) conditions.minRecovery = 55;

  const earn = text.match(/earnings?\s*>\s*(\d+)/);
  if (earn) conditions.minEarnings = Number(earn[1]);
  else if (/improving earnings|earnings acceleration/.test(text)) conditions.minEarnings = 60;

  if (/not value trap|not traps/.test(text)) extra.push("exclude_value_trap");
  if (/falling knife/.test(text)) conditions.signals = ["FALLING_KNIFE"];
  if (/historically cheap|inexpensive/.test(text)) {
    conditions.minValuation = conditions.minValuation ?? 70;
    extra.push("historically_inexpensive");
  }
  if (/flexicap|flexi cap/.test(text)) extra.push("category:flexi");
  if (/low drawdown/.test(text)) extra.push("max_drawdown_fund:20");

  return { asset, conditions, extra };
}

export async function runNaturalLanguageScreen(q: string) {
  const parsed = parseResearchQuery(q);
  if (parsed.asset === "FUND") {
    let rows = await loadFundRows({ plan: "DIRECT", option: "GROWTH" });
    if (parsed.extra.includes("category:flexi")) rows = rows.filter((r) => /flexi/i.test(r.category));
    if (parsed.extra.some((e) => e.startsWith("max_drawdown_fund:"))) {
      const max = Number(parsed.extra.find((e) => e.startsWith("max_drawdown_fund:"))!.split(":")[1]);
      rows = rows.filter((r) => r.maxDrawdown != null && Math.abs(r.maxDrawdown) <= max);
    }
    if (parsed.conditions.minQuality != null) {
      rows = rows.filter((r) => (r.consistency ?? r.overallScore ?? -1) >= parsed.conditions.minQuality!);
    }
    return {
      query: q,
      filters: parsed,
      note: "Translated into the filters above. Results use local precomputed scores only.",
      rows: rows.slice(0, 25),
    };
  }
  if (parsed.asset === "STOCK") {
    const rows = (await loadStockRows()).filter((r) =>
      matchesScreen(
        {
          assetId: r.id,
          name: r.symbol,
          asOf: r.asOf,
          close: r.close ?? 0,
          distanceFromAth: r.distanceFromAth ?? 0,
          return1m: r.return1m,
          return3m: r.return3m,
          return1y: r.return1y,
          recoveryScore: 0,
          opportunityScore: r.opportunityScore ?? 0,
          qualityScore: r.qualityScore,
          valuationScore: r.valuationScore,
          earningsScore: r.earningsScore,
          rsScore: r.rsScore,
          priceVs200: r.priceVs200,
          signal: r.classification ?? "WATCHLIST",
        },
        parsed.conditions,
      ),
    );
    const filtered = parsed.extra.includes("exclude_value_trap")
      ? rows.filter((r) => r.classification !== "VALUE_TRAP")
      : rows;
    return { query: q, filters: parsed, note: "Stock fundamentals are N/A unless a licensed feed is configured.", rows: filtered.slice(0, 25) };
  }
  const rows = (await loadScannerRows({ returnType: "PR" })).filter((r) =>
    matchesScreen(
      {
        assetId: r.indexId,
        name: r.name,
        asOf: r.athDate,
        close: r.current,
        distanceFromAth: r.distanceFromAth,
        return1m: r.return1m,
        return3m: r.return3m,
        return1y: r.return1y,
        recoveryScore: r.recoveryScore,
        opportunityScore: r.opportunityScore,
        qualityScore: null,
        valuationScore: null,
        earningsScore: null,
        rsScore: r.rs1yNifty50,
        priceVs200: r.priceVs200,
        signal: r.signal,
      },
      parsed.conditions,
    ),
  );
  return { query: q, filters: parsed, note: "Sector screen from the existing NSE engine. Point-in-time local scores only.", rows: rows.slice(0, 25) };
}

export async function answerFromAppData(question: string) {
  const screen = await runNaturalLanguageScreen(question);
  return {
    question,
    filtersUsed: screen.filters,
    results: screen.rows,
    note: screen.note,
    disclaimer:
      "Answered only from application data. The assistant does not invent prices, NAVs, fundamentals, or future returns.",
  };
}
