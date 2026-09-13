"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import Link from "next/link";
import { formatNumber, formatPct } from "@/lib/utils";
import { Pct, SignalBadge } from "@/components/signal-badge";
import { WhyPanel } from "@/components/why-panel";
import { TechnicalOverviewCard } from "@/components/technical-overview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Term } from "@/components/term";

export default function Page() {
  const params = useParams<{ id: string }>();
  const [range, setRange] = useState("5Y");
  const detail = useQuery({
    queryKey: ["index", params.id],
    queryFn: () => fetch(`/api/indices/${params.id}`).then((r) => r.json()),
  });
  const hist = useQuery({
    queryKey: ["hist", params.id, range],
    queryFn: () => fetch(`/api/indices/${params.id}/history?range=${range}`).then((r) => r.json()),
  });
  const dd = useQuery({
    queryKey: ["dd", params.id],
    queryFn: () => fetch(`/api/indices/${params.id}/drawdown`).then((r) => r.json()),
  });
  const ai = useMutation({
    mutationFn: () =>
      fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indexId: Number(params.id) }),
      }).then((r) => r.json()),
  });

  const snap = detail.data?.snapshot;
  const meta = detail.data?.meta;
  if (!snap || !meta) return <p className="text-mute">Loading sector from local database…</p>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-mute">{meta.category}</div>
          <h2 className="text-2xl font-semibold">{meta.name}</h2>
          <p className="mt-2 max-w-3xl text-sm text-mute">{snap.whyShort ?? snap.researchNote}</p>
        </div>
        <div className="text-right">
          <div className="num text-3xl">{formatNumber(snap.current)}</div>
          <div className="text-sm">1D <Pct value={snap.change1d} /></div>
          <div className="mt-2 flex justify-end gap-2">
            <SignalBadge value={snap.classification} />
            <SignalBadge value={snap.signal} />
          </div>
        </div>
      </header>

      <WhyPanel title="Why this reading" explanation={snap.explanation} />
      {snap.technical ? <TechnicalOverviewCard tape={snap.technical} /> : null}

      <div className="grid gap-3 md:grid-cols-5">
        {[
          ["drawdown", formatPct(-snap.distanceFromAth)],
          ["athDate", snap.athDate],
          ["ath", formatNumber(snap.closingAth)],
          ["opportunity", snap.opportunityScore.toFixed(0)],
          ["recovery", snap.recoveryScore.toFixed(0)],
        ].map(([k, v]) => (
          <Card key={k}>
            <CardContent className="px-3 py-2">
              <div className="text-[11px] uppercase text-mute">
                <Term id={k} />
              </div>
              <div className="num mt-1">{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="rounded border border-line bg-elev p-3">
        <div className="mb-2 flex gap-2 text-xs">
          {["1Y", "2Y", "5Y", "10Y", "MAX"].map((r) => (
            <button key={r} type="button" className={r === range ? "text-accent" : "text-mute"} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
          <span className="ml-auto text-mute">Price return (PR) · peak line · 50-DMA · 200-DMA</span>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hist.data?.series ?? []}>
              <CartesianGrid stroke="var(--line)" />
              <XAxis dataKey="date" hide />
              <YAxis stroke="var(--muted)" />
              <Tooltip />
              <ReferenceLine y={hist.data?.ath} stroke="var(--warn)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="close" stroke="var(--accent)" dot={false} name="Price" />
              <Line type="monotone" dataKey="ma50" stroke="var(--info)" dot={false} name="50-DMA" />
              <Line type="monotone" dataKey="ma200" stroke="var(--pos)" dot={false} name="200-DMA" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded border border-line bg-elev p-3">
        <h3 className="mb-2 text-xs uppercase text-mute">Historical drawdown from ATH</h3>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hist.data?.drawdowns ?? []}>
              <CartesianGrid stroke="var(--line)" />
              <XAxis dataKey="date" hide />
              <YAxis stroke="var(--muted)" />
              <Tooltip />
              {[20, 30, 40, 50, 60].map((t) => (
                <ReferenceLine key={t} y={-t} stroke="var(--line)" />
              ))}
              <Line type="monotone" dataKey="drawdownPercent" stroke="var(--neg)" dot={false} name="Drawdown %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        {Object.entries({
          "1D": snap.return1d,
          "1W": snap.return1w,
          "1M": snap.return1m,
          "3M": snap.return3m,
          "6M": snap.return6m,
          "1Y": snap.return1y,
          "2Y": snap.return2y,
          "3Y": snap.return3y,
          "5Y": snap.return5y,
        }).map(([k, v]) => (
          <div key={k} className="rounded border border-line px-3 py-2">
            <div className="text-[11px] text-mute">{k}</div>
            <Pct value={v as number | null} />
          </div>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["dma50", "vs 50-DMA", snap.priceVs50],
          ["dma200", "vs 200-DMA", snap.priceVs200],
          ["rs", "vs peers (1 month)", snap.rs1mNifty50],
          ["rs", "vs peers (1 year)", snap.rs1yNifty50],
        ].map(([id, label, v]) => (
          <Card key={String(label)}>
            <CardContent className="px-3 py-2">
              <div className="text-[11px] text-mute">
                <Term id={String(id)}>{label}</Term>
              </div>
              <Pct value={v as number | null} />
            </CardContent>
          </Card>
        ))}
      </section>

      {dd.data ? (
        <section className="rounded border border-line bg-elev p-3 text-sm">
          <h3 className="mb-2 text-xs uppercase text-mute">Historical drawdown context</h3>
          <p>
            Maximum historical drawdown {formatPct(Number(dd.data.maxHistoricalDrawdown))} on{" "}
            {dd.data.maxHistoricalDrawdownDate}. Prior episodes &gt;30% / &gt;40% / &gt;50%:{" "}
            {dd.data.priorDrawdowns30} / {dd.data.priorDrawdowns40} / {dd.data.priorDrawdowns50}. Days
            currently below 40%: {dd.data.daysBelow40}. Recovery from trough:{" "}
            {formatPct(dd.data.recoveryFromTroughPct != null ? Number(dd.data.recoveryFromTroughPct) : null)}.
            Current drawdown percentile:{" "}
            {dd.data.drawdownPercentile != null ? `${Number(dd.data.drawdownPercentile).toFixed(0)}th` : "n/a"}.
          </p>
        </section>
      ) : null}

      <section>
        <Button type="button" variant="outline" onClick={() => ai.mutate()}>
          Optional AI analysis (structured metrics only)
        </Button>
        {ai.data ? <pre className="mt-3 overflow-auto rounded border border-line bg-elev p-3 text-xs">{JSON.stringify(ai.data, null, 2)}</pre> : null}
      </section>

      <SectorFunds name={meta.name} />
    </div>
  );
}

function SectorFunds({ name }: { name: string }) {
  const q = useQuery({
    queryKey: ["sector-funds", name],
    queryFn: () => fetch(`/api/mutual-funds/sector/${encodeURIComponent(name)}`).then((r) => r.json()),
  });
  const funds = q.data?.funds ?? [];
  return (
    <section className="rounded border border-line bg-elev p-3">
      <h3 className="text-xs uppercase tracking-wide text-mute">Mutual funds with exposure to this sector</h3>
      <p className="mt-1 text-xs text-mute">
        Uses official holdings when ingested; otherwise a labelled category mapping. Research scores only.
      </p>
      <ul className="mt-2 divide-y divide-line/60">
        {funds.slice(0, 12).map((f: { id: number; schemeName: string; exposure: number; overallScore: number | null; return1y: number | null; cagr5y: number | null; sharpe: number | null }) => (
          <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <Link href={`/mutual-funds/${f.id}`} className="hover:text-accent">
              {f.schemeName}
            </Link>
            <div className="text-right text-xs">
              <div>Exposure {f.exposure?.toFixed?.(0) ?? "—"}%</div>
              <div>
                Score {f.overallScore?.toFixed?.(1) ?? "—"} · 1Y <Pct value={f.return1y} />
              </div>
            </div>
          </li>
        ))}
        {!funds.length ? <li className="py-3 text-sm text-mute">No mapped funds yet, or MF history has not been scored.</li> : null}
      </ul>
    </section>
  );
}
