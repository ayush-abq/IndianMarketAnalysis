import { cn } from "@/lib/utils";
import { Term } from "./term";
import { glossaryEntry, humanizeCode, termLabel } from "@/lib/glossary";
import { Badge } from "@/components/ui/badge";

const STYLES: Record<string, string> = {
  FALLING_KNIFE: "border-neg text-neg",
  EARLY_RECOVERY: "border-pos text-pos",
  RECOVERING: "border-pos text-pos",
  STRUCTURAL_WEAKNESS: "border-warn text-warn",
  POSSIBLE_CAPITULATION: "border-warn text-warn",
  EXTREME_DRAWDOWN: "border-neg text-neg",
  DEEPLY_BEATEN_DOWN: "border-warn text-warn",
  STRONG: "border-pos text-pos",
  IMPROVING: "border-info text-info",
  WEAK: "border-mute text-mute",
  WEAK_MOMENTUM: "border-mute text-mute",
  NOT_QUALIFYING: "border-line text-mute",
  ELITE: "border-pos text-pos",
  TOP_TIER: "border-pos text-pos",
  ABOVE_AVERAGE: "border-info text-info",
  AVERAGE: "border-mute text-mute",
  HIGH_RISK_HIGH_REWARD: "border-warn text-warn",
  UNDERPERFORMER: "border-neg text-neg",
  AVOID_FOR_RESEARCH: "border-neg text-neg",
  EARLY_RECOVERY_FUND: "border-pos text-pos",
  CONTRARIAN_RESEARCH: "border-warn text-warn",
  RESEARCH: "border-line text-mute",
};

export function SignalBadge({ value }: { value: string }) {
  const id = glossaryEntry(value) ? value : `class.${value}`;
  const label = termLabel(id, humanizeCode(value));
  return (
    <span className={cn("chip inline-flex h-5 max-h-5 w-auto shrink-0 items-center rounded-md border px-1.5 text-[10px] font-medium leading-none", STYLES[value] ?? "border-line text-mute")}>
      <Term id={id} className="font-medium no-underline decoration-transparent">
        {label}
      </Term>
    </span>
  );
}

const STRUCTURE_TONE: Record<string, "bullish" | "bearish" | "neutral" | "warn"> = {
  FRESH_BREAKOUT: "bullish",
  RECENT_BREAKOUT: "bullish",
  TREND_CONTINUATION: "bullish",
  COILED: "warn",
  FAILED_BREAKOUT: "bearish",
  NO_SETUP: "neutral",
};

export function StructureBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-mute">—</span>;
  const id = glossaryEntry(value) ? value : `class.${value}`;
  return (
    <span className="inline-flex items-center">
      <Badge variant={STRUCTURE_TONE[value] ?? "neutral"}>
        <Term id={id} className="font-medium no-underline decoration-transparent">
          {termLabel(id, humanizeCode(value))}
        </Term>
      </Badge>
    </span>
  );
}

export function Pct({ value, invert }: { value: number | null | undefined; invert?: boolean }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-mute">Insufficient history</span>;
  }
  const neg = invert ? value > 0 : value < 0;
  return (
    <span className={cn("num", neg ? "text-neg" : value > 0 ? "text-pos" : "text-ink")}>
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}
