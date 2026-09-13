"use client";

import { formatPct } from "@/lib/utils";
import { featureLabel } from "@/lib/glossary";
import { Term } from "./term";

type Horizon = {
  rawProbability?: number | null;
  calibratedProbability?: number | null;
  expectedReturn?: number | null;
  status?: string;
};

const HORIZONS = [
  { key: "1M", term: "horizon1m" },
  { key: "3M", term: "horizon3m" },
  { key: "6M", term: "horizon6m" },
  { key: "1Y", term: "horizon1y" },
] as const;

export function PredictionCard({
  prediction,
  debate,
  conflicts,
}: {
  prediction: {
    available?: boolean;
    reason?: string;
    status?: string;
    experimental?: boolean;
    horizons?: Record<string, Horizon>;
    drawdown?: Record<string, Horizon>;
    gains?: Record<string, Horizon>;
    importance?: { key: string; weight: number }[];
    modelCard?: { limitations?: string | null; status?: string; trainingPeriod?: string | null } | null;
  } | null;
  debate?: {
    source?: string;
    analyst?: Record<string, unknown>;
    critic?: Record<string, unknown>;
    synthesis?: Record<string, unknown>;
    confidence?: { band?: string; score?: number; note?: string };
  } | null;
  conflicts?: { label?: string; note?: string } | null;
}) {
  if (!prediction) return null;
  if (!prediction.available) {
    return (
      <section className="rounded border border-line bg-elev p-3">
        <h3 className="text-sm font-medium">Local model card</h3>
        <p className="mt-1 text-sm text-mute">{prediction.reason ?? "This name has not been trained yet."}</p>
      </section>
    );
  }
  const h = prediction.horizons ?? {};
  const dd = prediction.drawdown ?? {};
  return (
    <section className="rounded border border-line bg-elev p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">What the local model estimates</h3>
        {prediction.experimental ? (
          <span className="text-[10px] uppercase tracking-wide text-warn">
            <Term id="experimental" />
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-mute">{prediction.status}</span>
        )}
      </div>
      <p className="text-xs text-mute">
        These are stored-model odds from official prices. The language model cannot change them. Hover a dotted word for a plain meaning.
      </p>
      <div className="grid gap-2 md:grid-cols-4">
        {HORIZONS.map(({ key, term }) => (
          <div key={key} className="rounded border border-line px-2 py-2">
            <div className="text-[11px] uppercase text-mute">
              <Term id={term} />
            </div>
            <div className="num mt-1 text-sm">
              <Term id="probability" /> {pct(h[key]?.calibratedProbability)}
            </div>
            {h[key]?.rawProbability != null ? (
              <div className="text-[11px] text-mute">
                <Term id="rawProbability" /> {pct(h[key]?.rawProbability)}
              </div>
            ) : null}
            {h[key]?.expectedReturn != null ? (
              <div className="text-[11px]">
                <Term id="expectedReturn" /> {formatPct(h[key]?.expectedReturn ?? null)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {(["1M", "3M", "6M"] as const).map((k) => (
          <div key={k} className="rounded border border-line px-2 py-1.5 text-xs">
            <Term id="drawdownRisk" /> ({k === "1M" ? "1 month" : k === "3M" ? "3 months" : "6 months"}):{" "}
            {pct(dd[k]?.calibratedProbability)}
          </div>
        ))}
      </div>
      {conflicts?.label ? (
        <p className="text-sm text-warn">
          {conflicts.label}. {conflicts.note}
        </p>
      ) : null}
      {prediction.importance?.length ? (
        <div className="text-xs">
          <div className="uppercase text-mute">What the trees used most</div>
          <p className="mt-1">
            {prediction.importance
              .slice(0, 6)
              .map((f) => `${featureLabel(f.key)} ${(f.weight * 100).toFixed(0)}%`)
              .join(" · ")}
          </p>
        </div>
      ) : null}
      {debate?.analyst && !("unavailable" in (debate.analyst as object)) ? (
        <div className="grid gap-2 md:grid-cols-2 text-sm">
          <div>
            <div className="text-[11px] uppercase text-mute">
              <Term id="analyst" /> — why it looks interesting
            </div>
            <p>{String((debate.synthesis as { why_attractive?: string })?.why_attractive ?? (debate.analyst as { thesis?: string }).thesis ?? "—")}</p>
          </div>
          <div>
            <div className="text-[11px] uppercase text-mute">
              <Term id="critic" /> — why not
            </div>
            <p>{String((debate.synthesis as { why_not?: string })?.why_not ?? JSON.stringify((debate.critic as { why_not?: string[] }).why_not ?? []))}</p>
          </div>
        </div>
      ) : null}
      {debate?.confidence ? (
        <p className="text-xs text-mute">
          Model confidence {debate.confidence.band}
          {debate.confidence.score != null ? ` (${debate.confidence.score.toFixed(0)})` : ""}. {debate.confidence.note}
        </p>
      ) : null}
    </section>
  );
}

function pct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(0)}%`;
}
