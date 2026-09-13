export type GlossaryEntry = {
  label: string;
  hint: string;
};

export const GLOSSARY: Record<string, GlossaryEntry> = {
  name: { label: "Name", hint: "The company, sector index, or fund scheme." },
  type: { label: "Type", hint: "Stock, sector index, or mutual fund." },
  price: { label: "Price / NAV", hint: "Latest official stock close or fund net asset value." },
  sortino: { label: "Downside risk/reward", hint: "Like Sharpe, but it only punishes falling periods. Higher was historically steadier on the way down." },
  maxDrawdown: { label: "Worst fall", hint: "The largest peak-to-trough drop in the stored official series." },
  symbol: { label: "Symbol", hint: "The NSE ticker, such as EXIDEIND or RELIANCE." },
  sector: { label: "Sector", hint: "The industry group this name belongs to, from the official index list." },
  close: { label: "Close", hint: "Yesterday’s official closing price (or the latest stored session)." },
  ath: {
    label: "Peak close",
    hint: "The highest official closing price we have stored. Not an intraday spike.",
  },
  athDate: { label: "Peak date", hint: "The session when that highest close was printed." },
  drawdown: {
    label: "Below peak",
    hint: "How far today’s close sits under the stored peak close. 30% below peak means the price would need to rise about 43% to get back there.",
  },
  return1m: { label: "1-month return", hint: "Percent change over about the last 21 trading sessions." },
  return3m: { label: "3-month return", hint: "Percent change over about the last 63 trading sessions." },
  return6m: { label: "6-month return", hint: "Percent change over about the last 126 trading sessions." },
  return1y: { label: "1-year return", hint: "Percent change over about the last 252 trading sessions." },
  return2y: { label: "2-year return", hint: "Percent change over about the last two years of official closes." },
  return3y: { label: "3-year return", hint: "Percent change over about three years of official closes." },
  return5y: { label: "5-year return", hint: "Percent change over about five years of official closes." },
  rsi: {
    label: "RSI (14)",
    hint: "Groww’s short-term heat. Near 70 is overbought; near 30 is oversold. It is not a buy or sell signal.",
  },
  overbought: {
    label: "Overbought",
    hint: "RSI at or above 70 — the recent bounce was fast. Groww marks this Bearish on the oscillator, not a sell order.",
  },
  oversold: {
    label: "Oversold",
    hint: "RSI at or below 30 — the name was sold hard. Groww marks this Bullish on the oscillator, not a buy order.",
  },
  bullish: {
    label: "Bullish",
    hint: "More official-tape votes (RSI, 50-DMA, 200-DMA, recent returns) point up than down. Research snapshot — not a buy.",
  },
  bearish: {
    label: "Bearish",
    hint: "More official-tape votes point down than up. Research snapshot — not a sell.",
  },
  neutral: {
    label: "Neutral",
    hint: "Indicators disagree or sit mid-range. Groww’s sideways bucket — not a hold recommendation.",
  },
  technicalOverview: {
    label: "Technical overview",
    hint: "Groww-style Bullish / Neutral / Bearish from official closes: RSI, 50-DMA, 200-DMA and recent returns. Votes become percentages that add to 100.",
  },
  dma50: {
    label: "50-DMA",
    hint: "50-day moving average — Groww’s short-term trend line. Close above it is a Bullish vote.",
  },
  dma200: {
    label: "200-DMA",
    hint: "200-day moving average — Groww’s long-term trend line. Close above it is a Bullish vote.",
  },
  vs200: {
    label: "vs 200-day average",
    hint: "How far the latest close is above or below the 200-session average.",
  },
  rs: {
    label: "vs peers",
    hint: "Relative strength: did this name beat or lag its sector / Nifty 50 over the last year?",
  },
  recovery: {
    label: "Recovery score",
    hint: "0–100 score of whether the tape is healing after a fall (higher is more repair, not a forecast).",
  },
  opportunity: {
    label: "Research score",
    hint: "A 0–100 blend of trend and quality of the stored tape. Research only — not a buy rating.",
  },
  classification: {
    label: "Research label",
    hint: "A short name for the current pattern (for example Early recovery). It is not advice to buy or sell.",
  },
  signal: {
    label: "Tape signal",
    hint: "The rule that fired from official prices, such as still falling or early repair.",
  },
  why: { label: "Why", hint: "The stored price or NAV facts that produced this label. Not a news story." },
  rank: { label: "Rank", hint: "Sort order on this screen only." },
  score: { label: "Score", hint: "A 0–100 research number from stored official data. Not a target price." },
  probability: {
    label: "Chance",
    hint: "The local model’s estimated probability that the next period finishes higher. Experimental — not a promise.",
  },
  rawProbability: {
    label: "Raw chance",
    hint: "The model’s first guess, before it is calibrated against past out-of-sample folds.",
  },
  expectedReturn: {
    label: "Typical move",
    hint: "The model’s average historical move after similar setups. Missing until enough outcomes are stored.",
  },
  drawdownRisk: {
    label: "Chance of a 20% fall",
    hint: "Model estimate that price drops 20% or more over that window. Experimental, not a stop-loss.",
  },
  horizon1m: { label: "Next 1 month", hint: "About the next 21 trading sessions." },
  horizon3m: { label: "Next 3 months", hint: "About the next 63 trading sessions." },
  horizon6m: { label: "Next 6 months", hint: "About the next 126 trading sessions." },
  horizon1y: { label: "Next 1 year", hint: "About the next 252 trading sessions." },
  horizon3y: { label: "3-year window", hint: "About three years of official closes or NAV. Shown as history, not a forecast." },
  horizon5y: { label: "5-year window", hint: "About five years of official closes or NAV. Shown as history, not a forecast." },
  horizon10y: { label: "10-year window", hint: "About ten years of official NAV. Stock and index 10-year totals are N/A until stored." },
  globalScenario: {
    label: "Market scenario",
    hint: "A label from official Nifty tape and sector breadth (Bull, Bear, Correction…). Not a news or geopolitics call.",
  },
  horizonReturn: {
    label: "This window",
    hint: "Official stored return over that lookback. Past percent, not a promise of the next period.",
  },
  analogue: {
    label: "Similar past setups",
    hint: "Older names that looked like this on the tape, and what happened next. History, not a prediction.",
  },
  corporateAction: {
    label: "Company events",
    hint: "Official split, bonus, dividend or rights from the NSE book-closure file. Used to adjust old prices.",
  },
  split: { label: "Split", hint: "One share was cut into more shares. The price drops; you own more shares." },
  bonus: { label: "Bonus", hint: "The company issued extra free shares. Old prices are adjusted so charts stay comparable." },
  dividend: { label: "Dividend", hint: "Cash paid to shareholders. We do not change the price chart for dividends." },
  rights: { label: "Rights", hint: "Shareholders were offered new shares, usually at a set price." },
  pe: { label: "P/E", hint: "Price divided by earnings per share. Shown only when a dated official filing is stored." },
  pb: { label: "P/B", hint: "Price divided by book value per share. Shown only when stored from a filing." },
  roe: { label: "ROE", hint: "Return on equity: profit versus shareholders’ funds. Filing only — never guessed." },
  roce: { label: "ROCE", hint: "Return on capital employed. Filing only — never guessed." },
  pr: {
    label: "Price return",
    hint: "Charts use the official close only. Dividends are not added back (that would be total return).",
  },
  experimental: {
    label: "Experimental",
    hint: "The model is trained but not promoted. Treat the percentages as a research sketch, not a live call.",
  },
  quality: { label: "Quality", hint: "How steady earnings and the balance sheet look — only when filings are stored." },
  valuation: { label: "Value", hint: "Whether the stored price looks cheap versus earnings or book. Missing = hidden." },
  earnings: { label: "Earnings", hint: "Profit trend from stored filings. Not guessed from the price chart." },
  momentum: { label: "Momentum", hint: "Whether recent official returns are still pointing up." },
  risk: { label: "Risk", hint: "How large the stored fall from peak has been, plus volatility when we have it." },
  nav: { label: "NAV", hint: "A mutual fund’s official net asset value per unit, from AMFI." },
  sip: { label: "SIP", hint: "Systematic Investment Plan: the same amount invested on a fixed schedule." },
  ter: { label: "TER", hint: "Total expense ratio — the fund’s yearly fee. Shown only when an official file has it." },
  aum: { label: "AUM", hint: "Assets under management: how much money is in the scheme. Official file only." },
  sharpe: { label: "Risk / reward", hint: "Sharpe-style ratio: extra return per unit of bumpiness. Higher is steadier historically." },
  consistency: { label: "Consistency", hint: "How often official NAV periods finished positive. Past luck, not a guarantee." },
  cagr: { label: "Yearly rate (CAGR)", hint: "The steady yearly percent that matches the stored total return." },
  cagr3y: { label: "3-year yearly rate", hint: "Official NAV compounded over about three years, shown as a yearly percent." },
  cagr5y: { label: "5-year yearly rate", hint: "Official NAV compounded over about five years, shown as a yearly percent." },
  cagr10y: { label: "10-year yearly rate", hint: "Official NAV compounded over about ten years, shown as a yearly percent." },
  category: { label: "Category", hint: "The AMFI scheme class, such as Flexi Cap or Sectoral — IT." },
  coiled: { label: "Coiled", hint: "Price is quiet and sitting just under a recent high — a squeeze, not a forecast." },
  breakout: { label: "Breakout", hint: "The official close cleared a 20- or 55-session high. It can fail the next day." },
  "class.FRESH_BREAKOUT": {
    label: "Fresh breakout",
    hint: "The latest official close cleared a 20- or 55-session high. It can fail the next session.",
  },
  "class.RECENT_BREAKOUT": {
    label: "Recent breakout",
    hint: "Broke out in the last few sessions and is still holding above that high.",
  },
  "class.COILED": {
    label: "Coiled",
    hint: "Quiet and sitting just under a recent high — a squeeze, not a forecast.",
  },
  "class.TREND_CONTINUATION": {
    label: "Trend continuation",
    hint: "Already above the short and long averages, and the latest close is still extending.",
  },
  "class.FAILED_BREAKOUT": {
    label: "Failed breakout",
    hint: "It cleared a recent high, then the official close gave that break back.",
  },
  "class.NO_SETUP": {
    label: "No setup",
    hint: "The stored bars do not show a coil, break, or failed break right now.",
  },
  watchlist: { label: "Watchlist", hint: "Your own research list. Adding a name is not a buy order." },
  paper: { label: "Paper trade", hint: "A pretend position used to check a thesis. No real money." },
  analyst: { label: "Local analyst", hint: "A local language model that writes a thesis from stored numbers. It cannot invent PE or NAV." },
  critic: { label: "Local critic", hint: "A second local model that argues the other side. Still not a buy or sell call." },
  "class.FALLING_KNIFE": {
    label: "Falling knife",
    hint: "Far below its peak and still dropping. A lower price is not automatically a bargain.",
  },
  "class.EARLY_RECOVERY": {
    label: "Early recovery",
    hint: "It fell hard, but the latest official tape is starting to heal. Still research, not a buy.",
  },
  "class.STRUCTURAL_WEAKNESS": {
    label: "Long-term weakness",
    hint: "Several years of official closes are still negative and below the long average.",
  },
  "class.POSSIBLE_CAPITULATION": {
    label: "Possible washout",
    hint: "A very deep fall with signs of panic. That can be a turning area — or just more pain.",
  },
  "class.RECOVERING": { label: "Recovering", hint: "Repair after a fall is underway on the official tape." },
  "class.IMPROVING": { label: "Improving", hint: "The recovery score is up, but the name may still be far from its peak." },
  "class.STRONG": { label: "Strong", hint: "Near its peak, above the long average, and the one-year return is positive." },
  "class.WEAK_MOMENTUM": { label: "Weak momentum", hint: "Not in free-fall, but the official tape is not repairing yet." },
  "class.WEAK": { label: "Weak", hint: "A soft research label from stored returns and trend. Not a sell order." },
  "class.NOT_QUALIFYING": { label: "Not in a screen", hint: "It did not meet this page’s rules. That is not a verdict on the company." },
  "class.INSUFFICIENT_HISTORY": {
    label: "Not enough history",
    hint: "We do not have enough official daily closes yet to compute this label.",
  },
  "class.DEEPLY_BEATEN_DOWN": { label: "Deeply beaten down", hint: "A large stored fall from the peak. Check whether it is still falling." },
  "class.EXTREME_DRAWDOWN": { label: "Extreme fall", hint: "At least 50% below the stored peak close." },
  "class.ELITE": { label: "Elite", hint: "Top research bucket on this screen’s own score — not a buy list." },
  "class.TOP_TIER": { label: "Top tier", hint: "High research score on this screen. Historical, not a forecast." },
  "class.ABOVE_AVERAGE": { label: "Above average", hint: "Better than the middle of this screen’s stored scores." },
  "class.AVERAGE": { label: "Average", hint: "Near the middle of this screen’s stored scores." },
  "class.HIGH_RISK_HIGH_REWARD": { label: "High risk / high reward", hint: "Large stored swings. The upside and the damage can both be big." },
  "class.UNDERPERFORMER": { label: "Laggard", hint: "Stored returns have trailed the screen’s typical name." },
  "class.AVOID_FOR_RESEARCH": { label: "Avoid for research", hint: "This screen’s rules say the tape is still hostile. Not a broker ‘sell’." },
  "class.EARLY_RECOVERY_FUND": { label: "Early recovery fund", hint: "Mapped sectors are healing and the fund’s own NAV is not collapsing." },
  "class.CONTRARIAN_RESEARCH": { label: "Contrarian research", hint: "Tied to beaten-down sectors. A research idea, not a buy." },
  "class.RESEARCH": { label: "Research only", hint: "A label for study. Never treated as a recommendation." },
};

export const FEATURE_LABELS: Record<string, string> = {
  return_1y: "1-year return",
  return_6m: "6-month return",
  return_3m: "3-month return",
  return_1m: "1-month return",
  drawdown: "Below peak",
  recovery_score: "Recovery score",
  volatility_20: "20-day bumpiness",
  rsi: "Short-term heat",
  rs_1y: "vs peers (1 year)",
  price_vs_200: "vs 200-day average",
  price_vs_50: "vs 50-day average",
};

export function glossaryEntry(id: string): GlossaryEntry | undefined {
  return GLOSSARY[id] ?? GLOSSARY[`class.${id}`];
}

export function humanizeCode(id: string) {
  return id
    .replace(/^class\./, "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function termLabel(id: string, fallback?: string) {
  return glossaryEntry(id)?.label ?? fallback ?? humanizeCode(id);
}

export function featureLabel(key: string) {
  return FEATURE_LABELS[key] ?? key.replaceAll("_", " ");
}

export function glossaryGroups() {
  return [
    {
      heading: "Price and trend",
      ids: ["close", "ath", "drawdown", "return1m", "return3m", "return1y", "return5y", "dma50", "dma200", "vs200", "rsi", "overbought", "oversold", "rs", "pr"],
    },
    {
      heading: "Groww-style tape",
      ids: ["technicalOverview", "bullish", "neutral", "bearish"],
    },
    {
      heading: "Research labels",
      ids: ["classification", "signal", "opportunity", "recovery", "why", "experimental", "breakout", "coiled"],
    },
    {
      heading: "Chart structure",
      ids: ["class.FRESH_BREAKOUT", "class.RECENT_BREAKOUT", "class.COILED", "class.TREND_CONTINUATION", "class.FAILED_BREAKOUT"],
    },
    {
      heading: "Model card",
      ids: ["probability", "rawProbability", "drawdownRisk", "horizon1m", "horizon3m", "horizon6m", "horizon1y", "horizon3y", "horizon5y", "horizon10y", "horizonReturn", "globalScenario", "analogue"],
    },
    {
      heading: "Company and fund facts",
      ids: ["corporateAction", "split", "bonus", "dividend", "pe", "pb", "roe", "nav", "sip", "ter", "aum", "sharpe", "cagr"],
    },
  ];
}
