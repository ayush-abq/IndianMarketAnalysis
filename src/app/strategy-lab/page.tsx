"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { formatPct } from "@/lib/utils";
import { DataGrid } from "@/components/data-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Stats = {
  signals: number;
  withOutcome: number;
  winRate: number | null;
  averageReturn: number | null;
  medianReturn: number | null;
  worst: number | null;
  benchmarkAverage: number | null;
  excessAverage: number | null;
  caution: string;
  confidence: string;
};

export default function Page() {
  const [from, setFrom] = useState("2018-01-01");
  const [to, setTo] = useState("2026-09-11");
  const [minDrawdown, setMinDrawdown] = useState(40);
  const [minRecovery, setMinRecovery] = useState(60);
  const [hold, setHold] = useState(252);
  const [universe, setUniverse] = useState("SECTOR");
  const [cost, setCost] = useState("base");

  const m = useMutation({
    mutationFn: () =>
      fetch("/api/strategy-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          minDrawdown,
          minRecovery,
          holdTradingDays: hold,
          universe,
          excludeFallingKnife: true,
          execution: "NEXT_SESSION",
          costScenario: cost,
        }),
      }).then((r) => r.json()),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Strategy Lab</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">
          Point-in-time screens. At date T the lab uses only information available on or before T.
          Default fill is the <strong>next session</strong> (not the signal-day close). Estimated round-trip costs are deducted.
          Results are historical, not forecasts. Robust out-of-sample profiles rank above the highest in-sample CAGR.
        </p>
      </div>
      <form
        className="grid gap-3 rounded border border-line bg-elev p-3 md:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <label className="text-sm">From<input type="date" className="mt-1 block w-full rounded border border-line bg-bg px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">To<input type="date" className="mt-1 block w-full rounded border border-line bg-bg px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="text-sm">Min drawdown<input type="number" className="mt-1 block w-full rounded border border-line bg-bg px-2 py-1" value={minDrawdown} onChange={(e) => setMinDrawdown(Number(e.target.value))} /></label>
        <label className="text-sm">Min recovery<input type="number" className="mt-1 block w-full rounded border border-line bg-bg px-2 py-1" value={minRecovery} onChange={(e) => setMinRecovery(Number(e.target.value))} /></label>
        <label className="text-sm">Hold (days)<input type="number" className="mt-1 block w-full rounded border border-line bg-bg px-2 py-1" value={hold} onChange={(e) => setHold(Number(e.target.value))} /></label>
        <label className="text-sm">
          Universe
          <select className="mt-1 block w-full rounded border border-line bg-bg px-2 py-1" value={universe} onChange={(e) => setUniverse(e.target.value)}>
            <option value="SECTOR">Sectors</option>
            <option value="STOCK">Stocks</option>
          </select>
        </label>
        <label className="text-sm">
          Cost
          <select className="mt-1 block w-full rounded border border-line bg-bg px-2 py-1" value={cost} onChange={(e) => setCost(e.target.value)}>
            <option value="low">Low (15 bps)</option>
            <option value="base">Base (40 bps)</option>
            <option value="high">High (80 bps)</option>
          </select>
        </label>
        <div className="md:col-span-6">
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? "Running look-ahead-safe backtest…" : "Run historical test"}
          </Button>
        </div>
      </form>
      {m.data?.disclaimer ? <p className="text-xs text-mute">{m.data.disclaimer}</p> : null}
      {m.data?.overall ? (
        <div className="grid gap-3 md:grid-cols-3">
          <StatCard title="Overall (historical)" s={m.data.overall} />
          <StatCard title="In-sample" s={m.data.inSample} />
          <StatCard title="Out-of-sample" s={m.data.outOfSample} />
        </div>
      ) : null}
      {m.data?.alpha ? (
        <section className="grid gap-3 rounded border border-line bg-elev p-3 text-sm md:grid-cols-2">
          <div>
            <h3 className="text-xs uppercase text-mute">Proof before action</h3>
            <p className="mt-1">Evidence: {m.data.alpha.evidence?.level} — {m.data.alpha.evidence?.reason}</p>
            <p className="num mt-1">Historical EV {formatPct(m.data.alpha.expectedValue?.expectedReturn)} · P(gain) {m.data.alpha.expectedValue?.pGain != null ? `${Number(m.data.alpha.expectedValue.pGain).toFixed(0)}%` : "N/A"}</p>
            <p className="mt-1 text-xs text-mute">{m.data.alpha.expectedValue?.note}</p>
            <p className="mt-1 text-xs text-mute">{m.data.alpha.execution?.note}</p>
          </div>
          <div>
            <h3 className="text-xs uppercase text-mute">Cost sensitivity · regime · robustness</h3>
            <p>Low {formatPct(m.data.alpha.costSensitivity?.low?.expectedReturn)} · Base {formatPct(m.data.alpha.costSensitivity?.base?.expectedReturn)} · High {formatPct(m.data.alpha.costSensitivity?.high?.expectedReturn)}</p>
            {m.data.alpha.costSensitivity?.flag ? <p className="text-warn">{m.data.alpha.costSensitivity.flag}</p> : null}
            <p className="mt-1">{m.data.alpha.bestForRegime?.note}</p>
            <p className="mt-1 text-xs text-mute">{m.data.alpha.survivorship}</p>
          </div>
        </section>
      ) : null}
      {m.data?.interpretation ? (
        <ul className="list-disc pl-5 text-sm text-mute">
          {m.data.interpretation.map((line: string) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}
      {m.data?.sensitivity?.length ? <SensitivityGrid rows={m.data.sensitivity} /> : null}
    </div>
  );
}

function SensitivityGrid({ rows }: { rows: { value: number; signals: number; stats: Stats }[] }) {
  const columns = useMemo<ColDef<(typeof rows)[number]>[]>(
    () => [
      { field: "value", headerName: "Threshold", valueFormatter: (p) => `${p.value}%` },
      { field: "signals", headerName: "Signals" },
      { colId: "avg", headerName: "Avg fwd", valueGetter: (p) => p.data?.stats.averageReturn, valueFormatter: (p) => formatPct(p.value) },
      { colId: "median", headerName: "Median", valueGetter: (p) => p.data?.stats.medianReturn, valueFormatter: (p) => formatPct(p.value) },
    ],
    [],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parameter sensitivity (min drawdown)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <DataGrid rows={rows} columns={columns} height={280} pagination={false} getRowId={(r) => String(r.value)} />
      </CardContent>
    </Card>
  );
}

function StatCard({ title, s }: { title: string; s: Stats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
      <p className="mt-2">Signals {s.signals} · Outcomes {s.withOutcome} · Confidence {s.confidence}</p>
      <p className="num mt-1">Win rate {s.winRate != null ? `${s.winRate.toFixed(1)}%` : "N/A"}</p>
      <p className="num">Avg subsequent {formatPct(s.averageReturn)} · Median {formatPct(s.medianReturn)}</p>
      <p className="num">Benchmark {formatPct(s.benchmarkAverage)} · Excess {formatPct(s.excessAverage)}</p>
      <p className="num">Worst {formatPct(s.worst)}</p>
      <p className="mt-2 text-xs text-mute">{s.caution}</p>
      </CardContent>
    </Card>
  );
}
