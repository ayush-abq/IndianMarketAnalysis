"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { DataGrid } from "@/components/data-grid";
import { LinkCell, PctCell, SignalCell, StanceCell, WhyCell, stanceOrder } from "@/components/grid-cells";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TechnicalOverview } from "@/scoring/technical-stance";

type StockRow = {
  id: number;
  symbol: string;
  sector: string | null;
  close: number | null;
  distanceFromAth: number | null;
  return1y: number | null;
  rsScore: number | null;
  opportunityScore: number | null;
  classification: string;
  whyShort: string;
  technical: TechnicalOverview;
};

export default function Page() {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState("");
  const list = useQuery({
    queryKey: ["stocks", q, index],
    queryFn: () => fetch(`/api/stocks?q=${encodeURIComponent(q)}&index=${encodeURIComponent(index)}`).then((r) => r.json()),
  });
  const rows = (list.data?.rows ?? []) as StockRow[];
  const columns = useMemo<ColDef<StockRow>[]>(
    () => [
      { field: "symbol", minWidth: 120, cellRenderer: (p: ICellRendererParams<StockRow>) => <LinkCell {...p} href={`/stocks/${p.data?.id}`} /> },
      { field: "sector", valueFormatter: (p) => p.value || "—" },
      { field: "technical", headerName: "Overview", minWidth: 120, comparator: (a, b) => stanceOrder(a?.overall, b?.overall), cellRenderer: StanceCell },
      {
        colId: "bullish",
        headerName: "Bullish %",
        headerTooltip: "Share of official-tape votes that are Bullish.",
        width: 110,
        valueGetter: (p) => p.data?.technical?.probabilities.bullish,
        valueFormatter: (p) => (p.value == null ? "—" : `${p.value}%`),
      },
      {
        colId: "neutral",
        headerName: "Neutral %",
        width: 110,
        valueGetter: (p) => p.data?.technical?.probabilities.neutral,
        valueFormatter: (p) => (p.value == null ? "—" : `${p.value}%`),
      },
      {
        colId: "bearish",
        headerName: "Bearish %",
        width: 110,
        valueGetter: (p) => p.data?.technical?.probabilities.bearish,
        valueFormatter: (p) => (p.value == null ? "—" : `${p.value}%`),
      },
      { field: "close", valueFormatter: (p) => (p.value == null ? "—" : Number(p.value).toFixed(2)) },
      { field: "distanceFromAth", headerName: "Below peak", valueFormatter: (p) => (p.value == null ? "—" : `${Number(p.value).toFixed(1)}%`) },
      { field: "return1y", cellRenderer: PctCell },
      { field: "rsScore", headerName: "vs peers", valueFormatter: (p) => (p.value == null ? "—" : Number(p.value).toFixed(0)) },
      { field: "opportunityScore", headerName: "Research score", valueFormatter: (p) => (p.value == null ? "—" : Number(p.value).toFixed(0)) },
      { field: "classification", minWidth: 140, cellRenderer: SignalCell },
      { field: "whyShort", headerName: "Why", minWidth: 240, flex: 1, cellRenderer: WhyCell },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Stocks</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">
          Official daily closes from NSE. Overview is Groww-style Bullish / Neutral / Bearish from RSI, 50-DMA, 200-DMA
          and recent returns. Hover a heading for a one-line meaning.
        </p>
      </div>
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => e.preventDefault()}>
        <Input className="max-w-xs" placeholder="Symbol or name" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="h-9 rounded-md border border-line bg-elev px-2 text-sm" value={index} onChange={(e) => setIndex(e.target.value)}>
          <option value="">All memberships</option>
          <option value="NIFTY50">Nifty 50</option>
          <option value="NIFTY100">Nifty 100</option>
          <option value="NIFTY200">Nifty 200</option>
          <option value="NIFTY500">Nifty 500</option>
          <option value="NIFTY_MIDCAP_150">Midcap 150</option>
          <option value="NIFTY_SMALLCAP_250">Smallcap 250</option>
        </select>
        <Button
          type="button"
          variant="outline"
          onClick={() => fetch("/api/stocks/ingest", { method: "POST" }).then(() => list.refetch())}
        >
          Ingest official bhavcopy
        </Button>
      </form>
      {list.data?.note ? <p className="text-xs text-mute">{list.data.note}</p> : null}
      <DataGrid
        rows={rows}
        columns={columns}
        height={640}
        pageSize={50}
        getRowId={(r) => String(r.id)}
        empty="No stock rows yet. Use “Ingest official bhavcopy” or npm run ingest:stocks after migration."
      />
    </div>
  );
}
