"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { formatPct } from "@/lib/utils";
import { WhyPanel } from "@/components/why-panel";
import { SignalBadge } from "@/components/signal-badge";
import { PredictionCard } from "@/components/prediction-card";
import { TechnicalOverviewCard } from "@/components/technical-overview";
import { Term } from "@/components/term";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { blendModelChances } from "@/scoring/technical-stance";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["stock", id],
    queryFn: () => fetch(`/api/stocks/${id}`).then((r) => r.json()),
  });
  const ml = useQuery({
    queryKey: ["stock-ml", id],
    queryFn: () => fetch(`/api/local-ai/predict/STOCK/${id}`).then((r) => r.json()),
  });
  const debate = useMutation({
    mutationFn: () =>
      fetch("/api/local-ai/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockId: Number(id) }),
      }).then((r) => r.json()),
  });
  const watch = useMutation({
    mutationFn: () =>
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType: "STOCK",
          assetId: Number(id),
          assetName: q.data?.stock?.symbol,
          thesis: "Sector recovery\nEarnings acceleration\nValuation attractive",
        }),
      }),
  });
  if (q.isLoading) return <p className="text-mute">Loading stock research…</p>;
  const d = q.data;
  if (!d?.stock) return <p className="text-neg">Stock not found.</p>;

  const prediction = ml.data?.prediction ?? ml.data;
  const horizons = prediction?.horizons ?? {};
  const drawdown = prediction?.drawdown ?? {};
  const model = blendModelChances({
    rise: horizons["1M"]?.calibratedProbability ?? horizons["6M"]?.calibratedProbability,
    fall20: drawdown["6M"]?.calibratedProbability ?? drawdown["1M"]?.calibratedProbability,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{d.stock.symbol} {d.stock.companyName ? `· ${d.stock.companyName}` : ""}</h2>
          <p className="text-sm text-mute">{[d.stock.industry, d.disclaimer].filter(Boolean).join(" · ")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {d.score?.classification ? <SignalBadge value={d.score.classification} /> : null}
            {d.score?.signal && d.score.signal !== d.score.classification ? <SignalBadge value={d.score.signal} /> : null}
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => watch.mutate()}>
          Add to watchlist
        </Button>
      </div>
      <WhyPanel title="Why this reading" explanation={d.explanation} />
      {d.technical ? <TechnicalOverviewCard tape={d.technical} model={model} /> : null}
      <PredictionCard prediction={prediction} debate={debate.data?.debate ?? ml.data?.debate} conflicts={ml.data?.conflicts} />
      <Button type="button" variant="outline" size="sm" onClick={() => debate.mutate()} disabled={debate.isPending}>
        {debate.isPending ? "Local analyst vs critic…" : "Ask the local analyst and critic"}
      </Button>
      <div className="grid gap-3 md:grid-cols-4">
        {d.drawdown ? <Metric id="drawdown" value={`${d.drawdown.distanceFromAthPercent.toFixed(1)}%`} /> : null}
        {d.returns?.y1 != null ? <Metric id="return1y" value={formatPct(d.returns.y1)} /> : null}
        {d.rsi != null ? <Metric id="rsi" value={Number(d.rsi).toFixed(1)} /> : null}
        {d.mas?.priceVs200 != null ? <Metric id="vs200" value={`${Number(d.mas.priceVs200).toFixed(1)}%`} /> : null}
      </div>
      {d.fundamentals ? (
        <Card>
          <CardHeader>
            <CardTitle>Company filings</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Term id="pe" /> {d.fundamentals.pe ?? "—"} · <Term id="pb" /> {d.fundamentals.pb ?? "—"} ·{" "}
            <Term id="roe" /> {d.fundamentals.roe ?? "—"} · <Term id="roce" /> {d.fundamentals.roce ?? "—"}
          </CardContent>
        </Card>
      ) : null}
      {d.corporateActions?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <Term id="corporateAction" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {d.corporateActions.map((a: { date: string; actionType: string; ratio: string | null }) => (
                <li key={`${a.date}-${a.actionType}`}>
                  {a.date} · <Term id={a.actionType.toLowerCase()} />
                  {a.ratio ? ` ${a.ratio}` : ""}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      {d.analogues?.comparable > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <Term id="analogue" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="num">
              {d.analogues.comparable} similar past names · next 6 months typical {formatPct(d.analogues.median6m)} · next year typical{" "}
              {formatPct(d.analogues.median12m)}
            </p>
            <p className="mt-1 text-xs text-mute">{d.analogues.disclaimer}</p>
          </CardContent>
        </Card>
      ) : null}
      <p className="text-xs text-mute">
        Peak and returns use the official close, adjusted for stored splits and bonuses. Hover any dotted word if a term is new.
      </p>
    </div>
  );
}

function Metric({ id, value }: { id: string; value: string }) {
  return (
    <Card>
      <CardContent className="px-3 py-2">
        <div className="text-[11px] uppercase text-mute">
          <Term id={id} />
        </div>
        <div className="num mt-1 text-lg">{value}</div>
      </CardContent>
    </Card>
  );
}
