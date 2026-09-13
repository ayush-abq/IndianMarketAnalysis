import { formatPct } from "@/lib/utils";
import { signalLabel, type ResearchSignal } from "@/scoring/signals";

export type NewsItem = { headline: string; source: string; date: string; url?: string };

export type RelatedTape = {
  name: string;
  weight?: number | null;
  signal?: string | null;
  return1y?: number | null;
  drawdown?: number | null;
  source?: string | null;
};

export type MarketExplanation = {
  headline: string;
  because: string[];
  against: string[];
  news: NewsItem[];
  newsNote: string;
};

export type ExplainInput = {
  kind: "INDEX" | "STOCK" | "FUND";
  name: string;
  signal?: string | null;
  classification?: string | null;
  return1m?: number | null;
  return3m?: number | null;
  return1y?: number | null;
  return2y?: number | null;
  return3y?: number | null;
  return5y?: number | null;
  priceVs50?: number | null;
  priceVs200?: number | null;
  rs1y?: number | null;
  drawdown?: number | null;
  recovery?: number | null;
  sharpe?: number | null;
  maxDrawdown?: number | null;
  consistency?: number | null;
  overallScore?: number | null;
  trendState?: string | null;
  category?: string | null;
  sectorName?: string | null;
  related?: RelatedTape[];
  news?: NewsItem[];
};

export const NEWS_UNAVAILABLE_NOTE =
  "NSE daily files and AMFI NAVs do not carry headlines. These reasons are the official price/NAV evidence that produced the label. We do not invent a news story. Attach a licensed feed with MARKET_NEWS_BASE_URL + MARKET_NEWS_API_KEY to show real events here.";

const INDEX_SIGNALS = new Set<string>([
  "FALLING_KNIFE",
  "EARLY_RECOVERY",
  "STRUCTURAL_WEAKNESS",
  "POSSIBLE_CAPITULATION",
  "RECOVERING",
  "IMPROVING",
  "STRONG",
  "WEAK_MOMENTUM",
  "NOT_QUALIFYING",
]);

function pretty(code: string | null | undefined) {
  if (!code) return "unclassified";
  const key = code.toUpperCase();
  if (INDEX_SIGNALS.has(key)) return signalLabel(key as ResearchSignal);
  return key.replaceAll("_", " ").toLowerCase();
}

function signed(label: string, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  const word = value > 0.15 ? "positive" : value < -0.15 ? "negative" : "flat";
  return `${label} is ${word} at ${formatPct(value)}`;
}

function vsMa(name: string, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return value >= 0
    ? `Price is above the ${name} by ${value.toFixed(1)}%`
    : `Price is below the ${name} by ${Math.abs(value).toFixed(1)}%`;
}

function belowHigh(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.abs(value);
}

function ruleFor(signal: string, input: ExplainInput): string | null {
  const dd = belowHigh(input.drawdown);
  const rec = input.recovery;
  switch (signal) {
    case "WEAK_MOMENTUM":
      return dd != null
        ? `Weak momentum is assigned when the name is still at least 20% below its stored high (here ${dd.toFixed(0)}%) and the recovery score is below 45${rec != null ? ` (here ${rec.toFixed(0)})` : ""} — so it has not earned Improving.`
        : "Weak momentum is the residual label: deep enough to study, but without the recovery score or short-term turn that would make it Improving.";
    case "IMPROVING":
      return `Improving is assigned when recovery score is at least 45${rec != null ? ` (here ${rec.toFixed(0)})` : ""} while the name is still at least 15% below its stored high${dd != null ? ` (here ${dd.toFixed(0)}%)` : ""}.`;
    case "RECOVERING":
      return `Recovering is assigned when recovery score is at least 65${rec != null ? ` (here ${rec.toFixed(0)})` : ""} and the name is still at least 20% below its stored high${dd != null ? ` (here ${dd.toFixed(0)}%)` : ""}.`;
    case "EARLY_RECOVERY":
    case "EARLY_RECOVERY_FUND":
      return "Early recovery is assigned on a deep drawdown plus a short-term turn (1-month or 20-session return up, and/or a reclaim of the 50-day average) with relative strength no longer deteriorating.";
    case "FALLING_KNIFE":
      return "Falling knife is assigned when drawdown is deep, the latest 1-month and 3-month returns are still sharply negative, price is below a declining 200-day average, and relative strength versus Nifty 50 is still worsening.";
    case "STRUCTURAL_WEAKNESS":
      return "Structural weakness is assigned when 1-year, 2-year and 5-year returns are all negative and price remains below the 200-day average.";
    case "POSSIBLE_CAPITULATION":
      return "Possible capitulation is a research label for an extreme drawdown plus a large recent decline or elevated volatility — not confirmed selling climax.";
    case "STRONG":
      return "Strong is assigned when the name is close to its stored high, above the 200-day average, and the 1-year return is positive.";
    case "NOT_QUALIFYING":
      return "Not qualifying means the drawdown is too shallow for a beaten-down study (under 20% from the stored high).";
    case "BEATEN_DOWN":
      return `Beaten down is assigned when drawdown is at least 30%${dd != null ? ` (here ${dd.toFixed(0)}%)` : ""} and recovery is still low${rec != null ? ` (${rec.toFixed(0)})` : ""}.`;
    case "WATCHLIST":
      return "Watchlist means no named recovery or quality class was met from the stored official bars. It is not a buy candidate.";
    case "VALUE_TRAP":
      return "Value trap is assigned when the valuation score looks cheap while earnings and quality do not support it. Fundamentals stay N/A until a licensed feed is configured.";
    case "OVEREXTENDED":
      return "Overextended is assigned when the name is near a high, well above the 200-day average, and the latest month is already a large gain.";
    case "CONFIRMED_RECOVERY":
      return "Confirmed recovery needs a deep prior drawdown, a high recovery score, and a reclaim of the 200-day area.";
    case "WEAK":
      if (input.kind !== "FUND") {
        return "Classification weak means this sits in a correction bucket — beaten down, but not a named recovery or falling-knife setup.";
      }
      return input.overallScore != null
        ? `Weak is a fund research class for a composite score of ${input.overallScore.toFixed(0)} (30–44). That score is NAV history only — not a headline.`
        : "Weak is a fund research class for a low composite NAV score.";
    case "UNDERPERFORMER":
    case "AVOID_FOR_RESEARCH":
      if (input.kind !== "FUND") return null;
      return "This fund class is a low composite of official NAV returns, risk and consistency — not a news call.";
    case "HIGH_RISK_HIGH_REWARD":
      if (input.kind !== "FUND") return null;
      return "High risk / high reward is assigned when historical max drawdown is severe (≤ −40%) and Sharpe is weak, even if the composite is mid-range.";
    case "ELITE":
    case "TOP_TIER":
    case "ABOVE_AVERAGE":
    case "AVERAGE":
      if (input.kind !== "FUND") return null;
      return input.overallScore != null
        ? `${pretty(signal)} is the composite NAV class for a research score of ${input.overallScore.toFixed(0)}.`
        : `${pretty(signal)} is a composite NAV class, not a forecast.`;
    case "CONTRARIAN_RESEARCH":
      return "Contrarian research means a mapped sleeve still has a large official-index drawdown. That is sector tape, not a news story.";
    default:
      return null;
  }
}

function relatedReasons(related: RelatedTape[] | undefined, kind: ExplainInput["kind"]) {
  if (!related?.length) return [];
  return related.slice(0, 3).map((r) => {
    const w = r.weight != null && r.weight > 0 && r.weight < 100 ? ` (${r.weight.toFixed(0)}% implied weight)` : "";
    const src = r.source === "holdings" ? "from stored holdings" : r.source === "category" ? "from AMFI category mapping" : "linked NSE sector";
    const bits = [
      r.signal ? `labelled ${pretty(r.signal)}` : null,
      r.return1y != null ? `1Y ${formatPct(r.return1y)}` : null,
      r.drawdown != null ? `${Math.abs(r.drawdown).toFixed(0)}% below its stored high` : null,
    ].filter(Boolean);
    const tape = bits.length ? ` — ${bits.join(", ")}` : " — no official sector tape stored yet";
    if (kind === "FUND") {
      return `This scheme’s ${src} points at ${r.name}${w}${tape}. That is the sector reason we can prove from local NSE files.`;
    }
    return `${r.name}${w} is the linked sector${tape}.`;
  });
}

export function explainMarketReading(input: ExplainInput): MarketExplanation {
  const signal = (input.signal ?? input.classification ?? "NOT_QUALIFYING").toUpperCase();
  const classLabel = (input.classification ?? "").toUpperCase();
  const headline = `${input.name}: ${pretty(signal)}`;
  const because: string[] = [];
  const against: string[] = [];

  const rule = ruleFor(signal, input);
  if (rule) because.push(rule);
  if (classLabel && classLabel !== signal) {
    const classRule = ruleFor(classLabel, input);
    if (classRule) because.push(`Classification ${pretty(classLabel)}: ${classRule}`);
  }

  const y1 = signed("1-year return", input.return1y);
  const m1 = signed("1-month return", input.return1m);
  const m3 = signed("3-month return", input.return3m);
  const y2 = signed("2-year return", input.return2y);
  const y3 = signed("3-year return", input.return3y);
  const y5 = signed("5-year return", input.return5y);
  const vs50 = vsMa("50-day average", input.priceVs50);
  const vs200 = vsMa("200-day average", input.priceVs200);
  const rs =
    input.rs1y == null
      ? null
      : input.rs1y >= 0
        ? `It is ahead of Nifty 50 over 1 year by ${input.rs1y.toFixed(1)} percentage points`
        : `It is behind Nifty 50 over 1 year by ${Math.abs(input.rs1y).toFixed(1)} percentage points`;
  const dd = belowHigh(input.drawdown);

  if (signal === "WEAK_MOMENTUM") {
    if (y1) because.push(`${y1} — that long window is why the tape is called weak, not a guessed headline.`);
    if (vs200) because.push(`${vs200} — the longer trend is not supporting a recovery label.`);
    if (m1) because.push(`${m1}.`);
    if (rs) because.push(`${rs}.`);
  } else if (signal === "IMPROVING" || signal === "RECOVERING" || signal === "EARLY_RECOVERY" || signal === "EARLY_RECOVERY_FUND") {
    if (m1 && (input.return1m ?? 0) > 0) {
      because.push(`${m1} — the short window has turned, which supports the improvement on the official tape.`);
    } else if (m1) {
      against.push(`${m1} — Improving/Recovering here is from recovery score and level vs the high, not a rising month.`);
    }
    if (m3) because.push(`${m3}.`);
    if (vs50) because.push(`${vs50}.`);
    if (input.recovery != null && signal !== "IMPROVING" && signal !== "RECOVERING") {
      because.push(`Recovery score is ${input.recovery.toFixed(0)} (price structure only).`);
    }
    if (dd != null && dd >= 15) {
      against.push(`It is still ${dd.toFixed(0)}% below the stored high — improvement is not a completed recovery.`);
    }
    if (y1 && (input.return1y ?? 0) < 0) against.push(`${y1} — the one-year tape is still negative.`);
  } else if (signal === "FALLING_KNIFE") {
    if (m1) because.push(`${m1} — still falling on the latest month.`);
    if (m3) because.push(`${m3}.`);
    if (vs200) because.push(`${vs200}, with no reclaim of the long average.`);
    if (rs) because.push(`${rs}.`);
    against.push("A falling-knife label means high drawdown and still-negative tape. It is not a bargain call.");
  } else if (signal === "STRUCTURAL_WEAKNESS") {
    if (y1) because.push(`${y1}.`);
    if (y2) because.push(`${y2}.`);
    if (y5) because.push(`${y5} — 1Y, 2Y and 5Y are together weak.`);
    if (vs200) because.push(`${vs200}.`);
  } else if (signal === "STRONG" || signal === "ELITE" || signal === "TOP_TIER") {
    if (y1) because.push(`${y1}.`);
    if (y3) because.push(`${y3}.`);
    if (vs200) because.push(`${vs200}.`);
    if (dd != null) because.push(`Distance from the stored high is ${dd.toFixed(0)}%.`);
  } else {
    if (m1) because.push(`${m1}.`);
    if (y1) because.push(`${y1}.`);
    if (y3) because.push(`${y3}.`);
    if (vs200) because.push(`${vs200}.`);
    if (rs) because.push(`${rs}.`);
    if (dd != null) because.push(`It is ${dd.toFixed(0)}% below its stored closing high.`);
  }

  if (input.kind === "FUND") {
    if (input.category) because.push(`AMFI category is ${input.category}.`);
    if (input.sharpe != null) because.push(`Historical Sharpe is ${input.sharpe.toFixed(2)} (past NAV path, not a forecast).`);
    if (input.maxDrawdown != null) because.push(`Worst official NAV drawdown in store is ${formatPct(input.maxDrawdown)}.`);
    if (input.consistency != null) because.push(`Consistency score is ${input.consistency.toFixed(0)}.`);
  }

  if (input.sectorName && input.kind === "STOCK") {
    because.push(`Official constituent industry/sector on file is ${input.sectorName}.`);
  }
  because.push(...relatedReasons(input.related, input.kind));

  if (input.trendState) {
    because.push(`Moving-average state is ${input.trendState.replaceAll("_", " ").toLowerCase()}.`);
  }

  if (!because.length) {
    because.push("Not enough official history is stored to name a driver. Missing is not treated as zero.");
  }

  return {
    headline,
    because,
    against,
    news: input.news ?? [],
    newsNote: NEWS_UNAVAILABLE_NOTE,
  };
}

export function whySummary(e: MarketExplanation, max = 2): string {
  const parts = [...e.because.slice(0, max), ...e.against.slice(0, 1)];
  return parts.join(" ");
}

export function explanationToNote(e: MarketExplanation): string {
  const why = e.because.map((b, i) => `${i + 1}. ${b}`).join(" ");
  const risk = e.against.length ? ` Caution: ${e.against.join(" ")}` : "";
  return `${e.headline}. Why: ${why}${risk}`;
}

export function explainIndexRow(row: {
  name: string;
  signal?: string | null;
  classification?: string | null;
  return1m?: number | null;
  return3m?: number | null;
  return1y?: number | null;
  return2y?: number | null;
  return5y?: number | null;
  priceVs50?: number | null;
  priceVs200?: number | null;
  rs1yNifty50?: number | null;
  distanceFromAth?: number | null;
  recoveryScore?: number | null;
  trendState?: string | null;
}) {
  return explainMarketReading({
    kind: "INDEX",
    name: row.name,
    signal: row.signal,
    classification: row.classification,
    return1m: row.return1m,
    return3m: row.return3m,
    return1y: row.return1y,
    return2y: row.return2y,
    return5y: row.return5y,
    priceVs50: row.priceVs50,
    priceVs200: row.priceVs200,
    rs1y: row.rs1yNifty50,
    drawdown: row.distanceFromAth,
    recovery: row.recoveryScore,
    trendState: row.trendState,
  });
}

export function matchRelatedSectors(
  scanner: { name: string; signal?: string | null; return1y?: number | null; distanceFromAth?: number | null }[],
  implied: { nseName: string; weight: number; source?: string }[],
): RelatedTape[] {
  return implied.map((e) => {
    const needle = e.nseName.replace(/^NIFTY\s+/i, "").toUpperCase();
    const row = scanner.find(
      (s) => s.name.toUpperCase() === e.nseName.toUpperCase() || s.name.toUpperCase().includes(needle),
    );
    return {
      name: row?.name ?? e.nseName,
      weight: e.weight,
      signal: row?.signal ?? null,
      return1y: row?.return1y ?? null,
      drawdown: row?.distanceFromAth ?? null,
      source: e.source ?? "category",
    };
  });
}
