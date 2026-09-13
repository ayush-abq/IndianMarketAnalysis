"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { DataGrid } from "@/components/data-grid";
import { LinkCell, PctCell, SignalCell, StanceCell, WhyCell } from "@/components/grid-cells";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Term } from "@/components/term";
import type { HorizonKey, HorizonMeta, HorizonRow } from "@/services/horizon-research";

type Board = {
  asOf: string | null;
  regime: string | null;
  regimeScore: number | null;
  scenario: { title: string; summary: string; preferred: string; caution: string };
  news: { items: { headline: string; source: string; date: string }[]; note: string };
  horizons: HorizonMeta[];
  byHorizon: Record<HorizonKey, { sectors: HorizonRow[]; funds: HorizonRow[]; stocks: HorizonRow[] }>;
  disclaimer: string;
};

export default function Page() {
  const q = useQuery({
    queryKey: ["horizons"],
    queryFn: () => fetch("/api/horizons").then((r) => r.json() as Promise<Board>),
  });
  const [horizon, setHorizon] = useState<HorizonKey>("1Y");
  if (q.isLoading) return <p className="text-mute">Ranking official lookbacks…</p>;
  const d = q.data;
  if (!d) return <p className="text-neg">Horizon board unavailable.</p>;
  const meta = d.horizons.find((h) => h.key === horizon) ?? d.horizons[3];
  const slice = d.byHorizon[horizon];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Horizon research</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">{d.disclaimer}</p>
        <p className="mt-2 text-xs text-mute">As of {d.asOf ?? "—"}.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>
                <Term id="globalScenario">{d.scenario.title}</Term>
              </CardTitle>
              <CardDescription>
                Official Nifty + sector breadth
                {d.regime ? ` · ${d.regime}` : ""}
                {d.regimeScore != null ? ` (${d.regimeScore.toFixed(0)})` : ""}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{d.scenario.summary}</p>
            <p className="text-mute">{d.scenario.preferred}</p>
            <p className="text-xs text-warn">{d.scenario.caution}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest news</CardTitle>
            <CardDescription>Licensed feed only — NSE EOD files have no headlines.</CardDescription>
          </CardHeader>
          <CardContent>
            {d.news.items?.length ? (
              <ul className="space-y-2 text-sm">
                {d.news.items.map((n) => (
                  <li key={`${n.date}-${n.headline}`}>
                    <div className="font-medium">{n.headline}</div>
                    <div className="text-[11px] text-mute">{n.source} · {n.date}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mute">{d.news.note}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={horizon} onValueChange={(v) => setHorizon(v as HorizonKey)}>
        <TabsList className="flex h-auto flex-wrap">
          {d.horizons.map((h) => (
            <TabsTrigger key={h.key} value={h.key}>
              <Term id={h.term}>{h.label}</Term>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={horizon} className="space-y-4">
          <p className="text-xs text-mute">
            {meta.note} Ranked by official stored {meta.kind === "cagr" ? "yearly rate or total" : "total"} return. Research only.
          </p>
          <Block title="Indexes / sectors" rows={slice?.sectors ?? []} empty="No sector has a positive official return on this window yet." />
          <Block title="Stocks" rows={slice?.stocks ?? []} empty="No listed stock has a stored positive return on this window — or this window is N/A (6M / 10Y)." />
          <Block title="Funds (Direct Growth)" rows={slice?.funds ?? []} empty="No Direct Growth fund has a stored positive return on this window." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Block({ title, rows, empty }: { title: string; rows: HorizonRow[]; empty: string }) {
  const columns = useMemo<ColDef<HorizonRow>[]>(
    () => [
      { field: "name", minWidth: 220, flex: 1.3, cellRenderer: (p: ICellRendererParams<HorizonRow>) => <LinkCell {...p} href={p.data?.href} /> },
      {
        colId: "overview",
        headerName: "Overview",
        width: 110,
        cellRenderer: (p: ICellRendererParams<HorizonRow>) =>
          p.data?.stance ? <StanceCell value={p.data.stance} /> : <Badge variant="neutral">—</Badge>,
      },
      { field: "horizonReturn", headerName: "This window", cellRenderer: PctCell },
      { field: "vs200", headerName: "vs 200-DMA", cellRenderer: PctCell },
      { field: "drawdown", headerName: "Below peak", valueFormatter: (p) => (p.value == null ? "N/A" : `${Number(p.value).toFixed(1)}%`) },
      { field: "classification", headerName: "Research label", minWidth: 140, cellRenderer: SignalCell },
      { field: "why", headerName: "Why", minWidth: 220, flex: 1, cellRenderer: WhyCell },
    ],
    [],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge variant="neutral">{rows.length}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <DataGrid rows={rows} columns={columns} height={Math.min(420, 160 + rows.length * 32)} pageSize={25} pagination={rows.length > 12} getRowId={(r) => `${r.type}-${r.id}`} empty={empty} />
      </CardContent>
    </Card>
  );
}
