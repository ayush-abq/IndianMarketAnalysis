"use client";

import Link from "next/link";
import { formatNumber, formatPct } from "@/lib/utils";
import { stanceLabel, type Stance, type TechnicalOverview } from "@/scoring/technical-stance";
import { Badge } from "@/components/ui/badge";
import { Pct, SignalBadge } from "@/components/signal-badge";

type CellProps<V = unknown, D = unknown> = {
  value?: V;
  data?: D;
  href?: string;
};

export function LinkCell(props: CellProps) {
  const href = props.href ?? (props.data as { href?: string } | undefined)?.href;
  if (!href || props.value == null) return <span>{props.value == null ? "—" : String(props.value)}</span>;
  return (
    <Link href={href} className="font-medium hover:text-accent">
      {String(props.value)}
    </Link>
  );
}

export function StanceCell(props: CellProps<Stance | TechnicalOverview | null>) {
  const raw = props.value;
  const stance: Stance | null =
    raw && typeof raw === "object" && "overall" in raw ? raw.overall : ((raw as Stance | null) ?? null);
  if (!stance) return <span className="text-mute">—</span>;
  const variant = stance === "BULLISH" ? "bullish" : stance === "BEARISH" ? "bearish" : "neutral";
  return <Badge variant={variant}>{stanceLabel(stance)}</Badge>;
}

export function SignalCell(props: CellProps<string | null>) {
  if (!props.value) return <span className="text-mute">—</span>;
  return <SignalBadge value={props.value} />;
}

export function PctCell(props: CellProps<number | null>) {
  return <Pct value={props.value} />;
}

export function WhyCell(props: CellProps<string | null>) {
  const text = props.value ?? "";
  return (
    <span className="block truncate text-[11px] text-mute" title={text}>
      {text || "—"}
    </span>
  );
}

type ValueCell = { value?: unknown };

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function pctValue(p: ValueCell) {
  return formatPct(asNumber(p.value));
}

export function numValue(digits = 2) {
  return (p: ValueCell) => formatNumber(asNumber(p.value), digits);
}

export function naValue(digits = 0) {
  return (p: ValueCell) => {
    const n = asNumber(p.value);
    return n == null ? "N/A" : n.toFixed(digits);
  };
}

export function stanceOrder(a?: Stance | null, b?: Stance | null) {
  const rank = { BULLISH: 2, NEUTRAL: 1, BEARISH: 0 };
  return (rank[a ?? "NEUTRAL"] ?? 1) - (rank[b ?? "NEUTRAL"] ?? 1);
}
