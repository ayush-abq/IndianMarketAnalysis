"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Term } from "@/components/term";
import {
  stanceLabel,
  type Stance,
  type TechnicalOverview,
} from "@/scoring/technical-stance";

function tone(s: Stance) {
  return s === "BULLISH" ? "bullish" : s === "BEARISH" ? "bearish" : "neutral";
}

export function TechnicalOverviewCard({
  tape,
  model,
}: {
  tape: TechnicalOverview;
  model?: { bullish: number | null; neutral: number | null; bearish: number | null } | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            <Term id="technicalOverview">Technical overview</Term>
          </CardTitle>
          <CardDescription>{tape.note}</CardDescription>
        </div>
        <Badge variant={tone(tape.overall)}>{stanceLabel(tape.overall)}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <Chance label="Bullish" term="bullish" value={tape.probabilities.bullish} variant="bullish" />
          <Chance label="Neutral" term="neutral" value={tape.probabilities.neutral} variant="neutral" />
          <Chance label="Bearish" term="bearish" value={tape.probabilities.bearish} variant="bearish" />
        </div>
        {model && (model.bullish != null || model.bearish != null) ? (
          <div>
            <div className="text-[11px] uppercase text-mute">Local model chances (experimental)</div>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              <Chance label="Chance of rise" term="probability" value={model.bullish} variant="bullish" />
              <Chance label="Sideways leftover" term="neutral" value={model.neutral} variant="neutral" />
              <Chance label="Chance of a 20% fall" term="drawdownRisk" value={model.bearish} variant="bearish" />
            </div>
          </div>
        ) : null}
        <ul className="space-y-1.5 text-sm">
          {tape.indicators.map((i) => (
            <li key={i.key} className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <Badge variant={tone(i.verdict)}>{stanceLabel(i.verdict)}</Badge>
                <span className="ml-2">{i.label}</span>
              </span>
              <span className="text-xs text-mute">{i.detail}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Chance({
  label,
  term,
  value,
  variant,
}: {
  label: string;
  term: string;
  value: number | null | undefined;
  variant: "bullish" | "bearish" | "neutral";
}) {
  if (value == null) return null;
  return (
    <div className="rounded-md border border-line px-2 py-2">
      <div className="text-[11px] uppercase text-mute">
        <Term id={term}>{label}</Term>
      </div>
      <div className="num mt-1 text-lg">
        <Badge variant={variant}>{value}%</Badge>
      </div>
    </div>
  );
}
