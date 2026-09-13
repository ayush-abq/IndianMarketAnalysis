"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber, formatPct } from "@/lib/utils";
import { Pct, SignalBadge } from "@/components/signal-badge";
import { WhyPanel } from "@/components/why-panel";

function stale(date: string | null | undefined, days: number) {
  if (!date) return true;
  return Date.now() - Date.parse(`${date}T00:00:00Z`) > days * 86400000;
}

export default function Page() {
  const params = useParams<{ id: string }>();
  const [range, setRange] = useState("5Y");
  const [sipAmt, setSipAmt] = useState("10000");
  const [freq, setFreq] = useState("monthly");
  const [why, setWhy] = useState(false);
  const d = useQuery({
    queryKey: ["fund", params.id],
    queryFn: () => fetch(`/api/mutual-funds/${params.id}`).then((r) => r.json()),
  });
  const nav = useQuery({
    queryKey: ["fund-nav", params.id],
    queryFn: () => fetch(`/api/mutual-funds/${params.id}/nav`).then((r) => r.json() as Promise<{ date: string; nav: number }[]>),
  });
  const sip = useQuery({
    queryKey: ["fund-sip", params.id, sipAmt, freq],
    queryFn: () => fetch(`/api/mutual-funds/${params.id}/sip?amount=${sipAmt}&frequency=${freq}`).then((r) => r.json()),
  });
  const ai = useMutation({
    mutationFn: () => fetch(`/api/mutual-funds/${params.id}/ai`, { method: "POST" }).then((r) => r.json()),
  });

  const fund = d.data?.fund;
  const snap = d.data?.snapshot;
  const score = d.data?.score;
  const risk = d.data?.risk;
  const ret = d.data?.returns;
  const fresh = d.data?.fresh;
  if (d.isLoading) return <p className="text-mute">Loading fund from local database…</p>;
  if (!fund) return <p className="text-neg">Fund not found.</p>;

  const series = (nav.data ?? []).map((p, i, arr) => {
    let peak = -Infinity;
    for (let j = 0; j <= i; j++) peak = Math.max(peak, arr[j].nav);
    return { ...p, peak, dd: peak > 0 ? -((peak - p.nav) / peak) * 100 : 0 };
  });
  const cut = (() => {
    const last = series.at(-1)?.date;
    if (!last || range === "MAX") return series;
    const years = range === "1Y" ? 1 : range === "3Y" ? 3 : range === "10Y" ? 10 : 5;
    const from = new Date(Date.parse(`${last}T00:00:00Z`));
    from.setUTCFullYear(from.getUTCFullYear() - years);
    const iso = from.toISOString().slice(0, 10);
    return series.filter((p) => p.date >= iso);
  })();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-mute">
            {fund.amcName} · {fund.assetClass} · {fund.category}
          </div>
          <h2 className="text-2xl font-semibold">{fund.schemeName}</h2>
          <p className="mt-1 text-xs text-mute">
            {fund.plan} plan · {fund.option} · scheme {fund.schemeCode}
            {fund.isin ? ` · ${fund.isin}` : ""}
          </p>
          <p className="mt-2 max-w-3xl text-sm text-mute">
            {d.data?.explanation ? d.data.explanation.because[0] : (score?.researchNote ?? "Research note pending more official NAV history.")}
          </p>
        </div>
        <div className="text-right">
          <div className="num text-3xl">{formatNumber(snap?.nav)}</div>
          <div className="text-xs text-mute">NAV {snap?.navDate ?? "—"}</div>
          <div className="mt-2 flex justify-end gap-2">
            {score?.classification ? <SignalBadge value={score.classification} /> : null}
            {score?.signal ? <SignalBadge value={score.signal} /> : null}
          </div>
          <div className="num mt-2 text-2xl">{score?.overallScore != null ? Number(score.overallScore).toFixed(1) : "—"}</div>
          <button type="button" className="text-xs underline" onClick={() => setWhy((v) => !v)}>
            Score weights
          </button>
        </div>
      </header>

      <WhyPanel title="Why this reading" explanation={d.data?.explanation} />

      {why && score?.explanation ? (
        <section className="rounded border border-line bg-elev p-3 text-sm">
          <div className="text-[11px] uppercase text-mute">Explainable ranking</div>
          <ul className="mt-2 list-disc pl-5">
            {(score.explanation as { used?: { key: string; weight: number; value: number }[] }).used?.map((u) => (
              <li key={u.key}>
                {u.key.replaceAll("_", " ")}: {u.value.toFixed(1)} (weight {u.weight})
              </li>
            )) ?? <li>Score parts stored with this row.</li>}
          </ul>
          {score.categoryPercentiles ? (
            <p className="mt-2 text-xs text-mute">Category percentiles: {JSON.stringify(score.categoryPercentiles)}</p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded border border-line bg-elev p-3 text-xs">
        <div className="text-[11px] uppercase text-mute">Data freshness</div>
        <div className="mt-2 grid gap-2 md:grid-cols-5">
          {[
            ["NAV", fresh?.navUpdated, 3],
            ["Portfolio", fresh?.portfolioUpdated, 45],
            ["AUM", fresh?.aumUpdated, 45],
            ["TER", fresh?.terUpdated, 45],
            ["Riskometer", fresh?.riskometerUpdated, 45],
          ].map(([k, v, days]) => (
            <div key={String(k)}>
              <div className="text-mute">{k} updated</div>
              <div className="num">{(v as string) ?? "not in official daily NAV"}</div>
              {stale(v as string, days as number) ? <div className="text-warn">Stale / unavailable</div> : null}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-6">
        {[
          ["1Y", ret?.return1y],
          ["3Y CAGR", ret?.cagr3y],
          ["5Y CAGR", ret?.cagr5y],
          ["10Y CAGR", ret?.cagr10y],
          ["Sharpe", risk?.sharpe],
          ["Max DD", risk?.maxDrawdown],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded border border-line bg-elev px-3 py-2">
            <div className="text-[11px] uppercase text-mute">{k}</div>
            <div className="mt-1">{String(k).includes("Sharpe") ? (v == null ? "—" : Number(v).toFixed(2)) : <Pct value={v == null ? null : Number(v)} />}</div>
          </div>
        ))}
      </div>

      <section className="rounded border border-line bg-elev p-3">
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          {["1Y", "3Y", "5Y", "10Y", "MAX"].map((r) => (
            <button key={r} type="button" className={`rounded border px-2 py-0.5 ${range === r ? "border-accent text-accent" : "border-line"}`} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cut}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip />
              <Line type="monotone" dataKey="nav" stroke="#9a6b16" dot={false} name="NAV" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded border border-line bg-elev p-3">
        <div className="text-[11px] uppercase text-mute">NAV drawdown from prior peak</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cut}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="dd" stroke="#b42318" dot={false} name="Drawdown %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-sm">
          Maximum historical drawdown: {risk?.maxDrawdown == null ? "insufficient history" : formatPct(Number(risk.maxDrawdown))}. Recovery days:{" "}
          {risk?.recoveryDays ?? "n/a"}.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-line bg-elev p-3">
          <div className="text-[11px] uppercase text-mute">Scorecard</div>
          <ul className="mt-2 space-y-1 text-sm">
            {[
              ["Return", score?.returnScore],
              ["Risk", score?.riskScore],
              ["Consistency", score?.consistencyScore],
              ["Drawdown", score?.drawdownScore],
              ["Cost", score?.expenseScore],
              ["Benchmark", score?.benchmarkScore],
              ["Portfolio", score?.portfolioScore],
              ["Manager", score?.managerScore],
              ["Sector alignment", score?.sectorAlignmentScore],
              ["Overall", score?.overallScore],
            ].map(([k, v]) => (
              <li key={String(k)} className="flex justify-between">
                <span>{k}</span>
                <span className="num">{v == null ? "omitted — no data" : Number(v).toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded border border-line bg-elev p-3">
          <div className="mb-2 flex items-end justify-between">
            <div className="text-[11px] uppercase text-mute">SIP (historical)</div>
            <div className="flex gap-2 text-xs">
              <select className="rounded border border-line bg-elev" value={sipAmt} onChange={(e) => setSipAmt(e.target.value)}>
                {["1000", "5000", "10000", "25000", "50000"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
              <select className="rounded border border-line bg-elev" value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>
          {["y1", "y3", "y5", "y7", "y10"].map((k) => {
            const row = sip.data?.[k];
            return (
              <div key={k} className="flex justify-between border-b border-line/50 py-1 text-sm">
                <span>{k.slice(1)}Y SIP</span>
                <span>
                  {row ? (
                    <>
                      XIRR <Pct value={row.xirr} /> · invested {formatNumber(row.invested, 0)}
                    </>
                  ) : (
                    "insufficient history"
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded border border-line bg-elev p-3">
        <div className="text-[11px] uppercase text-mute">Sector context (linked to NSE engine)</div>
        <p className="mt-1 text-xs text-mute">
          Holdings-based weights when official monthly portfolios exist. Otherwise a labelled category implication — never a fabricated book.
        </p>
        <div className="mt-3 space-y-2">
          {(d.data?.sectors ?? []).map((s: { nseName: string; weight: number; source: string; sectorName: string; indexId: number | null; drawdown: number | null; return1y: number | null; recoveryScore: number | null; signal: string | null; classification: string | null }) => (
            <div key={s.nseName} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 py-2 text-sm">
              <div>
                {s.indexId ? <Link className="hover:text-accent" href={`/indices/${s.indexId}`}>{s.sectorName}</Link> : s.sectorName}
                <div className="text-xs text-mute">
                  {s.weight.toFixed(1)}% · source {s.source}
                </div>
              </div>
              <div className="text-right text-xs">
                <div>Drawdown {s.drawdown == null ? "—" : formatPct(-s.drawdown)}</div>
                <div>1Y <Pct value={s.return1y} /> · recovery {s.recoveryScore ?? "—"}</div>
                {s.signal ? <SignalBadge value={s.signal} /> : null}
              </div>
            </div>
          ))}
          {!(d.data?.sectors ?? []).length ? <p className="text-sm text-mute">No mapped NSE sector exposure for this category.</p> : null}
        </div>
      </section>

      <section className="rounded border border-line bg-elev p-3 text-sm">
        <div className="text-[11px] uppercase text-mute">Tax / cost context</div>
        <p className="mt-2">{d.data?.tax?.taxCategory}</p>
        <p className="text-xs text-mute">{d.data?.tax?.holdingPeriodContext}</p>
        <p className="text-xs text-mute">{d.data?.tax?.source}</p>
        <p className="mt-2 text-xs">
          Manager: {fund.fundManager ?? "not in official daily NAV"} · Benchmark: {fund.benchmark ?? "not in official daily NAV"} · Riskometer:{" "}
          {fund.riskometer ?? "not in official daily NAV"}
        </p>
      </section>

      <button type="button" className="rounded border border-line px-3 py-1.5 text-sm" onClick={() => ai.mutate()}>
        AI fund analyst (structured DB metrics only)
      </button>
      {ai.data ? (
        <pre className="overflow-auto rounded border border-line bg-elev p-3 text-xs">{JSON.stringify(ai.data, null, 2)}</pre>
      ) : null}
    </div>
  );
}
