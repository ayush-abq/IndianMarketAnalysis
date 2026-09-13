"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { DataGrid } from "@/components/data-grid";
import { LinkCell, WhyCell } from "@/components/grid-cells";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StructureBadge } from "@/components/signal-badge";
import { termLabel } from "@/lib/glossary";

type Row = {
  type: string;
  id: number;
  name: string;
  href: string;
  close: number;
  label: string;
  distanceTo20HighPct: number | null;
  daysSinceBreakout: number | null;
  higherHighsHigherLows: boolean | null;
  volumeConfirms: boolean | null;
  trendState: string | null;
  why: string[];
  risks: string[];
};

type Payload = {
  asOf: string | null;
  disclaimer: string;
  scanned: { stocks: number; indices: number };
  stocks: { fresh: Row[]; recent: Row[]; coiled: Row[]; failed: Row[] };
  indices: { fresh: Row[]; coiled: Row[]; failed: Row[] };
};

export default function Page() {
  const q = useQuery({
    queryKey: ["structure"],
    queryFn: () => fetch("/api/structure").then((r) => r.json() as Promise<Payload>),
  });
  if (q.isLoading) return <p className="text-mute">Reading official EOD bars for structure…</p>;
  const d = q.data;
  if (!d) return <p className="text-neg">Structure scan unavailable.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Breakouts and chart structure</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">{d.disclaimer}</p>
        <p className="mt-2 text-xs text-mute">
          As of {d.asOf ?? "—"} · scanned {d.scanned.stocks} stocks and {d.scanned.indices} indices with enough history.
        </p>
      </div>
      <Block title="Stocks — fresh 20/55-session breaks" rows={d.stocks.fresh} empty="No official close cleared a 20- or 55-session high today." />
      <Block title="Stocks — broke out in the last 5 sessions, still above" rows={d.stocks.recent} empty="No recent breaks still holding." />
      <Block title="Stocks — coiled under the 20-session high" rows={d.stocks.coiled} empty="No compressed bases sitting within 2% of the 20-session high." />
      <Block title="Indices — breaks or recent holds" rows={d.indices.fresh} empty="No index 20/55-session break as of this close." />
      <Block title="Indices — coiled" rows={d.indices.coiled} empty="No coiled sector/benchmark index." />
      <Block title="Failed breaks (stocks)" rows={d.stocks.failed} empty="No given-back 20-session breaks in the last 10 sessions." />
    </div>
  );
}

function Block({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  const columns = useMemo<ColDef<Row>[]>(
    () => [
      {
        field: "name",
        minWidth: 200,
        flex: 1.2,
        cellRenderer: (p: ICellRendererParams<Row>) => (
          <div>
            <LinkCell {...p} href={p.data?.href} />
            <div className="text-[11px] text-mute">{p.data?.trendState?.replaceAll("_", " ") ?? ""}</div>
          </div>
        ),
      },
      {
        colId: "setup",
        headerName: "Setup",
        minWidth: 150,
        valueGetter: (p) => termLabel(p.data?.label ?? "", p.data?.label ?? ""),
        cellRenderer: (p: ICellRendererParams<Row>) => <StructureBadge value={p.data?.label ?? null} />,
      },
      {
        colId: "close",
        headerName: "Close",
        width: 110,
        valueGetter: (p) => (p.data?.close == null ? "—" : Number(p.data.close).toFixed(2)),
      },
      {
        colId: "vs20",
        headerName: "Vs 20-high",
        width: 140,
        valueGetter: (p) => {
          const v = p.data?.distanceTo20HighPct;
          if (v == null) return "N/A";
          return v > 0 ? `${v.toFixed(1)}% below` : `${Math.abs(v).toFixed(1)}% through`;
        },
      },
      {
        colId: "hhl",
        headerName: "HH/HL",
        width: 90,
        valueGetter: (p) => (p.data?.higherHighsHigherLows == null ? "N/A" : p.data.higherHighsHigherLows ? "Yes" : "No"),
      },
      {
        colId: "volume",
        headerName: "Volume",
        width: 110,
        valueGetter: (p) => (p.data?.volumeConfirms == null ? "N/A" : p.data.volumeConfirms ? "Confirms" : "Weak"),
      },
      {
        colId: "structure",
        headerName: "Structure",
        minWidth: 240,
        flex: 1,
        valueGetter: (p) => p.data?.why[0] ?? "",
        cellRenderer: (p: ICellRendererParams<Row>) => (
          <div>
            <WhyCell {...p} value={p.data?.why[0] ?? ""} />
            {p.data?.risks[0] ? <div className="text-[11px] text-warn">{p.data.risks[0]}</div> : null}
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="whitespace-normal leading-snug">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <DataGrid
          rows={rows}
          columns={columns}
          height={Math.max(260, Math.min(420, 180 + rows.length * 42))}
          pageSize={25}
          pagination={rows.length > 12}
          getRowId={(r) => `${r.type}-${r.id}`}
          empty={empty}
        />
      </CardContent>
    </Card>
  );
}
