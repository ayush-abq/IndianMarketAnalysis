"use client";

import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { ScannerRow } from "@/lib/types";
import { DataGrid } from "@/components/data-grid";
import { LinkCell, PctCell, SignalCell, StanceCell, WhyCell, numValue, stanceOrder } from "@/components/grid-cells";

export function ScannerTable({ rows }: { rows: ScannerRow[] }) {
  const columns = useMemo<ColDef<ScannerRow>[]>(
    () => [
      { field: "rank", maxWidth: 88 },
      {
        field: "name",
        headerName: "Sector",
        minWidth: 220,
        flex: 1.4,
        cellRenderer: (p: ICellRendererParams<ScannerRow>) => <LinkCell {...p} href={`/indices/${p.data?.indexId}`} />,
      },
      { field: "technical", headerName: "Overview", minWidth: 120, comparator: (a, b) => stanceOrder(a?.overall, b?.overall), cellRenderer: StanceCell },
      {
        colId: "bullish",
        headerName: "Bullish %",
        headerTooltip: "Share of official-tape votes that are Bullish. Adds to Neutral and Bearish at 100.",
        width: 110,
        valueGetter: (p) => p.data?.technical.probabilities.bullish,
        valueFormatter: (p) => (p.value == null ? "—" : `${p.value}%`),
      },
      { field: "current", headerName: "Close", valueFormatter: numValue(2) },
      { field: "ath", headerName: "Peak close", valueFormatter: numValue(2) },
      { field: "athDate", headerName: "Peak date" },
      { field: "distanceFromAth", headerName: "Below peak", cellRenderer: (p: ICellRendererParams<ScannerRow, number>) => <PctCell {...p} value={p.value == null ? null : -p.value} /> },
      { field: "return1y", cellRenderer: PctCell },
      { field: "return2y", cellRenderer: PctCell },
      { field: "return5y", cellRenderer: PctCell },
      { field: "return3m", cellRenderer: PctCell },
      { field: "return6m", cellRenderer: PctCell },
      { field: "ma50", headerName: "50-DMA", valueFormatter: numValue(2) },
      { field: "ma200", headerName: "200-DMA", valueFormatter: numValue(2) },
      { field: "rs1yNifty50", headerName: "vs peers", cellRenderer: PctCell },
      { field: "recoveryScore", headerName: "Recovery", valueFormatter: (p) => (p.value == null ? "—" : Number(p.value).toFixed(0)) },
      { field: "opportunityScore", headerName: "Research score", valueFormatter: (p) => (p.value == null ? "—" : Number(p.value).toFixed(0)) },
      { field: "classification", cellRenderer: SignalCell, minWidth: 140 },
      { field: "signal", cellRenderer: SignalCell, minWidth: 140 },
      { field: "whyShort", headerName: "Why", minWidth: 240, flex: 1, cellRenderer: WhyCell },
    ],
    [],
  );

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      height={640}
      pageSize={50}
      getRowId={(r) => String(r.indexId)}
      empty="No computed scanner rows yet. Configure an official/authorized data source and run ingestion."
    />
  );
}
