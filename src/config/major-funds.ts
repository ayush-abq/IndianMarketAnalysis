/**
 * Well-known Direct Growth sleeves to always show on Today.
 * Match official AMFI scheme names already in the local database.
 * Missing names stay off the list — nothing is invented.
 */
export type MajorFundSleeve = {
  id: string;
  label: string;
  test: (schemeName: string) => boolean;
  prefer?: RegExp[];
};

export const MAJOR_FUND_SLEEVES: MajorFundSleeve[] = [
  { id: "bandhan-small", label: "Bandhan Small Cap", test: (n) => /bandhan\s+small cap fund/i.test(n) },
  { id: "nippon-small", label: "Nippon Small Cap", test: (n) => /nippon india small cap fund/i.test(n) },
  { id: "sbi-small", label: "SBI Small Cap", test: (n) => /sbi small cap fund/i.test(n) },
  { id: "quant-small", label: "Quant Small Cap", test: (n) => /quant small cap fund/i.test(n) },
  { id: "hdfc-small", label: "HDFC Small Cap", test: (n) => /hdfc small cap fund/i.test(n) },
  { id: "hdfc-mid", label: "HDFC Mid Cap", test: (n) => /hdfc mid cap fund/i.test(n) && !/large/i.test(n) },
  { id: "motilal-lmid", label: "Motilal Large & Midcap", test: (n) => /motilal oswal large and midcap fund/i.test(n) },
  { id: "kotak-mid", label: "Kotak Mid Cap", test: (n) => /kotak mid cap fund/i.test(n) && !/large|index/i.test(n) },
  { id: "axis-mid", label: "Axis Midcap", test: (n) => /axis mid ?cap fund/i.test(n) },
  { id: "ppfas-flexi", label: "Parag Parikh Flexi Cap", test: (n) => /parag parikh flexi/i.test(n) },
  { id: "hdfc-flexi", label: "HDFC Flexi Cap", test: (n) => /hdfc flexi ?cap fund/i.test(n) },
  { id: "sbi-flexi", label: "SBI Flexicap", test: (n) => /sbi flexi\s*cap fund/i.test(n) },
  { id: "icici-bluechip", label: "ICICI Prudential Large Cap", test: (n) => /icici prudential (bluechip|large cap) fund/i.test(n) },
  { id: "mirae-lmid", label: "Mirae Large & Midcap", test: (n) => /mirae asset large ?& ?mid ?cap/i.test(n) },
  { id: "hdfc-lmid", label: "HDFC Large & Mid Cap", test: (n) => /hdfc large ?& ?mid cap fund/i.test(n) },
  {
    id: "idx-nifty50",
    label: "Nifty 50 Index",
    test: (n) => /nifty 50 index fund/i.test(n) && !/equal weight|next 50|quality|esg|value|top 20/i.test(n),
    prefer: [/uti /i, /hdfc /i, /nippon /i, /sbi /i, /icici /i],
  },
  {
    id: "idx-next50",
    label: "Nifty Next 50 Index",
    test: (n) => /nifty next 50 index fund/i.test(n),
    prefer: [/uti /i, /hdfc /i, /icici /i, /sbi /i],
  },
  {
    id: "idx-mid150",
    label: "Nifty Midcap 150 Index",
    test: (n) => /nifty midcap 150 index fund/i.test(n) && !/quality|momentum|value/i.test(n),
    prefer: [/hdfc /i, /uti /i, /motilal /i, /icici /i],
  },
  {
    id: "idx-small250",
    label: "Nifty Smallcap 250 Index",
    test: (n) => /nifty smallcap 250 index fund/i.test(n),
    prefer: [/bandhan /i, /hdfc /i, /uti /i, /motilal /i],
  },
  {
    id: "idx-sensex",
    label: "Sensex Index",
    test: (n) => /sensex index fund/i.test(n) && !/next|equal/i.test(n),
    prefer: [/hdfc /i, /uti /i, /sbi /i],
  },
];

export function matchMajorSleeve(schemeName: string, sleeve: MajorFundSleeve) {
  return sleeve.test(schemeName);
}
