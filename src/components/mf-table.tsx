"use client";

import { useMemo } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { MfRow } from "@/services/mf-queries";
import { DataGrid } from "@/components/data-grid";
import { LinkCell, PctCell, SignalCell, WhyCell, numValue } from "@/components/grid-cells";
import { Button } from "@/components/ui/button";
import { SignalBadge } from "@/components/signal-badge";

type Row = MfRow & { rank: number };

function NameCell(props: ICellRendererParams<Row> & { onCompare?: (id: number) => void }) {
  const r = props.data;
  if (!r) return null;
  return (
    <div>
      <LinkCell {...props} value={r.schemeName} href={`/mutual-funds/${r.id}`} />
      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-mute">
        <span>{r.plan}</span>
        <span>{r.option}</span>
        {r.signal ? <SignalBadge value={r.signal} /> : null}
        {props.onCompare ? (
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-[10px]" onClick={() => props.onCompare?.(r.id)}>
            compare
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function MfTable({ rows, onCompare }: { rows: MfRow[]; onCompare?: (id: number) => void }) {
  const data = useMemo(() => rows.map((r, i) => ({ ...r, rank: i + 1 })), [rows]);
  const columns = useMemo<ColDef<Row>[]>(
    () => [
      { field: "rank", maxWidth: 88 },
      {
        field: "schemeName",
        headerName: "Name",
        minWidth: 280,
        flex: 1.6,
        cellRenderer: (p: ICellRendererParams<Row>) => <NameCell {...p} onCompare={onCompare} />,
      },
      { field: "category", minWidth: 140 },
      { field: "nav", valueFormatter: numValue(2) },
      { field: "return1y", cellRenderer: PctCell },
      { field: "cagr3y", cellRenderer: PctCell },
      { field: "cagr5y", cellRenderer: PctCell },
      { field: "cagr10y", cellRenderer: PctCell },
      { field: "sharpe", valueFormatter: (p) => (p.value == null ? "—" : Number(p.value).toFixed(2)) },
      { field: "sortino", valueFormatter: (p) => (p.value == null ? "—" : Number(p.value).toFixed(2)) },
      { field: "maxDrawdown", cellRenderer: PctCell },
      { field: "expenseRatio", headerName: "TER", valueFormatter: (p) => (p.value == null ? "—" : `${Number(p.value).toFixed(2)}%`) },
      { field: "aum", headerName: "AUM", valueFormatter: numValue(0) },
      { field: "sip5y", headerName: "SIP", cellRenderer: PctCell },
      { field: "consistency", valueFormatter: (p) => (p.value == null ? "—" : Number(p.value).toFixed(0)) },
      { field: "overallScore", headerName: "Score", valueFormatter: (p) => (p.value == null ? "—" : Number(p.value).toFixed(1)) },
      { field: "classification", cellRenderer: SignalCell, minWidth: 140 },
      { field: "whyShort", headerName: "Why", minWidth: 220, flex: 1, cellRenderer: WhyCell },
    ],
    [onCompare],
  );

  return (
    <DataGrid
      rows={data}
      columns={columns}
      height={640}
      pageSize={50}
      getRowId={(r) => String(r.id)}
      empty="No scored funds yet. Official AMFI NAV history must be ingested and precomputed. The dashboard never invents NAVs or returns."
    />
  );
}
