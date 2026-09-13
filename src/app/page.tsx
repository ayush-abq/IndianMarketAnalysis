"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { formatPct } from "@/lib/utils";
import { Term } from "@/components/term";
import { StructureBadge } from "@/components/signal-badge";
import { DataGrid } from "@/components/data-grid";
import { LinkCell, WhyCell } from "@/components/grid-cells";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PickRow = {
  type: string;
  id: number;
  name: string;
  href: string;
  trend: "UP" | "MIXED" | "DOWN" | "UNKNOWN";
  why: string;
  riskReward: string;
  fundamentals: string;
  technicals: string;
  caution: string;
  sleeve?: string;
};

type Today = {
  asOf: string | null;
  regime: string | null;
  regimeScore: number | null;
  disclaimer: string;
  gaps: string[];
  sectors: PickRow[];
  funds: PickRow[];
  majorFunds: PickRow[];
  stocks: PickRow[];
  coverage: { sectorsScanned: number; fundsScanned: number; stocksWithHistory: number; stocksListed: number };
};

type StructureRow = {
  id: number;
  name: string;
  href: string;
  label: string;
  close: number;
  distanceTo20HighPct: number | null;
  why: string[];
};

type Structure = {
  stocks: { fresh: StructureRow[]; coiled: StructureRow[] };
  indices: { fresh: StructureRow[]; coiled: StructureRow[] };
};

export default function DashboardPage() {
  const q = useQuery({
    queryKey: ["today"],
    queryFn: () => fetch("/api/today").then((r) => r.json() as Promise<Today>),
  });
  const structure = useQuery({
    queryKey: ["structure-home"],
    queryFn: () => fetch("/api/structure").then((r) => r.json() as Promise<Structure>),
  });
  const horizons = useQuery({
    queryKey: ["horizons-home"],
    queryFn: () => fetch("/api/horizons").then((r) => r.json()),
  });

  if (q.isLoading) return <p className="text-mute">Reading local scores…</p>;
  if (!q.data) return <p className="text-neg">Today’s shortlist is unavailable.</p>;
  const d = q.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">What looks constructive today</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">{d.disclaimer}</p>
        <p className="mt-1 text-xs text-mute">
          New here? Hover any dotted word, or open{" "}
          <Link className="text-accent hover:underline" href="/glossary">
            Terms explained
          </Link>
          .
        </p>
        <p className="mt-2 text-xs text-mute">
          As of {d.asOf ?? "—"}
          {d.regime ? ` · market ${d.regime}` : ""}
          {d.regimeScore != null ? ` (${d.regimeScore.toFixed(0)})` : ""}.
          Scanned {d.coverage.sectorsScanned} sectors · {d.coverage.fundsScanned} Direct Growth funds ·{" "}
          {d.coverage.stocksWithHistory}/{d.coverage.stocksListed} stocks with enough price history.
        </p>
      </div>

      {d.gaps.length ? (
        <div className="rounded border border-warn/50 bg-elev px-3 py-2 text-sm text-warn">
          {d.gaps.map((g) => (
            <p key={g}>{g}</p>
          ))}
        </div>
      ) : null}

      <HorizonTeaser data={horizons.data} loading={horizons.isLoading} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Column title="Sectors going up" href="/scanner" empty="No sector passed the rising + not-falling screen." rows={d.sectors} />
        <Column title="Funds with better risk/reward" href="/mutual-funds/best" empty="No Direct Growth fund passed the screen." rows={d.funds} />
        <Column
          title="Stocks — price trend only"
          href="/stocks"
          empty="Need more official daily files before 1Y, ATH and DMA exist."
          rows={d.stocks}
        />
      </div>

      <section className="rounded border border-line bg-elev">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
          <div>
            <h3 className="text-sm font-medium">Chart structure — official EOD, not Chartink</h3>
            <p className="text-xs text-mute">
              20/55-session highs, HH/HL, range compression, volume vs 20-session average. A coil is not a prediction.
            </p>
          </div>
          <Link className="text-xs text-accent hover:underline" href="/structure">
            Full breakout board
          </Link>
        </div>
        {structure.isLoading ? (
          <p className="px-3 py-3 text-sm text-mute">Scanning official bars…</p>
        ) : (
          <div className="grid gap-4 p-3 md:grid-cols-2">
            <MiniList title="Stocks just breaking the 20/55-session high" rows={structure.data?.stocks.fresh ?? []} />
            <MiniList title="Stocks coiled under the high" rows={structure.data?.stocks.coiled ?? []} />
            <MiniList title="Indices breaking or holding a break" rows={structure.data?.indices.fresh ?? []} />
            <MiniList title="Indices coiled" rows={structure.data?.indices.coiled ?? []} />
          </div>
        )}
      </section>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Major funds — small cap, mid cap, flexi, index</CardTitle>
            <p className="text-xs text-mute">
              Direct Growth only. These sleeves stay on the page even when they fail the tight Sharpe screen.
              Numbers are official NAV history, not a buy list.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="link" size="sm">
              <Link href="/mutual-funds/index-funds">All index funds</Link>
            </Button>
            <Button asChild variant="link" size="sm">
              <Link href="/mutual-funds/best">Best funds</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!d.majorFunds?.length ? (
            <p className="px-3 py-4 text-sm text-mute">No matching Direct Growth schemes in the local AMFI store yet.</p>
          ) : (
            <MajorFundsGrid rows={d.majorFunds} />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-mute">
        Want the full terminal?{" "}
        <Link className="text-accent hover:underline" href="/radar">
          Opportunity Radar
        </Link>
        {" · "}
        <Link className="text-accent hover:underline" href="/strategy-lab">
          Strategy Lab
        </Link>
        {" · "}
        <Link className="text-accent hover:underline" href="/falling-knives">
          What to avoid
        </Link>
      </p>
    </div>
  );
}

function Column({ title, href, empty, rows }: { title: string; href: string; empty: string; rows: PickRow[] }) {
  return (
    <Card>
        <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Button asChild variant="link" size="sm">
          <Link href={href}>All</Link>
        </Button>
      </CardHeader>
      {!rows.length ? <p className="px-3 py-4 text-sm text-mute">{empty}</p> : null}
      <ul>
        {rows.map((r) => (
          <li key={`${r.type}-${r.id}`} className="border-t border-line px-3 py-3 first:border-t-0">
            <Link href={r.href} className="block hover:text-accent">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium leading-snug">{r.name}</span>
                <TrendBadge trend={r.trend} />
              </div>
              <p className="mt-1 text-xs text-mute">{r.why}</p>
              <dl className="mt-2 space-y-1 text-xs">
                <Row id="sharpe" fallback="Risk / reward" value={r.riskReward} />
                {r.fundamentals && !/N\/A|licensed|no PE\/ROE/i.test(r.fundamentals) ? (
                  <Row id="quality" fallback="Company facts" value={r.fundamentals} />
                ) : null}
                <Row id="momentum" fallback="Price trend" value={r.technicals} />
              </dl>
              <p className="mt-2 text-[11px] text-mute">{r.caution}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Row({ id, fallback, value }: { id: string; fallback: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <dt className="text-mute">
        <Term id={id}>{fallback}</Term>
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function MiniList({ title, rows }: { title: string; rows: StructureRow[] }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-mute">{title}</h4>
      {!rows.length ? <p className="mt-2 text-xs text-mute">None as of this close.</p> : (
        <ul className="mt-2 space-y-1.5">
          {rows.slice(0, 6).map((r) => (
            <li key={r.id}>
              <Link href={r.href} className="text-sm hover:text-accent">{r.name}</Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-mute">
                <StructureBadge value={r.label} />
                <span>{r.why[0] ?? ""}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MajorFundsGrid({ rows }: { rows: PickRow[] }) {
  const columns = useMemo<ColDef<PickRow>[]>(
    () => [
      { field: "sleeve", headerName: "Sleeve", valueFormatter: (p: { value?: string; data?: PickRow }) => p.value ?? p.data?.why ?? "—", maxWidth: 140 },
      { field: "name", headerName: "Scheme", minWidth: 240, flex: 1.4, cellRenderer: (p: ICellRendererParams<PickRow>) => <LinkCell {...p} href={p.data?.href} /> },
      { colId: "overview", headerName: "Overview", width: 120, cellRenderer: (p: ICellRendererParams<PickRow>) => <TrendBadge trend={p.data?.trend ?? "UNKNOWN"} /> },
      { colId: "return1y", headerName: "1-year return", width: 130, valueGetter: (p: { data?: PickRow }) => p.data?.technicals.split(" · ")[0] ?? "—" },
      { field: "riskReward", headerName: "Risk / reward", minWidth: 160 },
      { field: "why", headerName: "Why", minWidth: 220, flex: 1, cellRenderer: WhyCell },
    ],
    [],
  );
  return <DataGrid rows={rows} columns={columns} height={420} pageSize={25} getRowId={(r) => String(r.id)} pagination={rows.length > 12} />;
}

function HorizonTeaser({ data, loading }: { data: Record<string, unknown> | undefined; loading: boolean }) {
  const scenario = data?.scenario as { title?: string; summary?: string } | undefined;
  const by = data?.byHorizon as Record<string, { sectors: { name: string; href: string; horizonReturn: number | null }[]; stocks: { name: string; href: string; horizonReturn: number | null }[]; funds: { name: string; href: string; horizonReturn: number | null }[] }> | undefined;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Which windows already paid</CardTitle>
          <p className="text-xs text-mute">
            Official lookback ranks — not a forecast. {scenario?.title ? `${scenario.title}. ` : ""}
            {scenario?.summary ?? ""}
          </p>
        </div>
        <Button asChild variant="link" size="sm">
          <Link href="/horizons">1M to 10Y board</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-mute">Ranking official lookbacks…</p> : (
          <div className="grid gap-4 md:grid-cols-3">
            <MiniHorizon title="1-month stocks" rows={by?.["1M"]?.stocks ?? []} />
            <MiniHorizon title="1-year sectors" rows={by?.["1Y"]?.sectors ?? []} />
            <MiniHorizon title="5-year funds (yearly rate)" rows={by?.["5Y"]?.funds ?? []} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniHorizon({ title, rows }: { title: string; rows: { name: string; href: string; horizonReturn: number | null }[] }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-mute">{title}</h4>
      {!rows.length ? <p className="mt-2 text-xs text-mute">None with a positive stored return.</p> : (
        <ul className="mt-2 space-y-1.5">
          {rows.slice(0, 4).map((r) => (
            <li key={r.href} className="flex items-baseline justify-between gap-2 text-sm">
              <Link href={r.href} className="truncate hover:text-accent">{r.name}</Link>
              <span className="num shrink-0">{formatPct(r.horizonReturn)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrendBadge({ trend }: { trend: PickRow["trend"] }) {
  const variant = trend === "UP" ? "bullish" : trend === "DOWN" ? "bearish" : "neutral";
  const label = trend === "UP" ? "Bullish" : trend === "DOWN" ? "Bearish" : "Neutral";
  return <Badge variant={variant}>{label}</Badge>;
}
