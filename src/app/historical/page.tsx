"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { formatPct } from "@/lib/utils";
import { DataGrid } from "@/components/data-grid";
import { PctCell, SignalCell } from "@/components/grid-cells";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type HistRow = {
  indexId: number;
  name: string;
  distanceFromAth: number;
  athDate: string;
  return1y: number | null;
  return2y: number | null;
  return5y: number | null;
  recoveryScore: number;
  signal: string;
  fwd6: number | null;
  fwd12: number | null;
  fwd24: number | null;
};

export default function Page() {
  const [asOf, setAsOf] = useState("2020-03-23");
  const [forward, setForward] = useState(true);
  const m = useMutation({
    mutationFn: () =>
      fetch(`/api/historical?asOf=${asOf}&forward=${forward ? "1" : "0"}`).then((r) => r.json()),
  });
  const rows = useMemo<HistRow[]>(
    () =>
      ((m.data?.rows ?? []) as Record<string, unknown>[]).map((r) => {
        const fwd = (r.forward as { returnPct: number | null }[] | undefined) ?? [];
        return {
          indexId: Number(r.indexId),
          name: String(r.name),
          distanceFromAth: Number(r.distanceFromAth),
          athDate: String(r.athDate),
          return1y: (r.return1y as number | null) ?? null,
          return2y: (r.return2y as number | null) ?? null,
          return5y: (r.return5y as number | null) ?? null,
          recoveryScore: Number(r.recoveryScore),
          signal: String(r.signal),
          fwd6: fwd[0]?.returnPct ?? null,
          fwd12: fwd[1]?.returnPct ?? null,
          fwd24: fwd[2]?.returnPct ?? null,
        };
      }),
    [m.data],
  );
  const columns = useMemo<ColDef<HistRow>[]>(
    () => [
      { field: "name", headerName: "Sector", minWidth: 200, flex: 1.2 },
      { field: "distanceFromAth", headerName: "Below peak", valueFormatter: (p) => (p.value == null ? "—" : `${Number(p.value).toFixed(1)}%`) },
      { field: "athDate", headerName: "Peak date" },
      { field: "return1y", cellRenderer: PctCell },
      { field: "return2y", cellRenderer: PctCell },
      { field: "return5y", cellRenderer: PctCell },
      { field: "recoveryScore", headerName: "Recovery", valueFormatter: (p) => (p.value == null ? "—" : Number(p.value).toFixed(0)) },
      { field: "signal", cellRenderer: SignalCell, minWidth: 140 },
      { field: "fwd6", headerName: "Fwd 6M", valueFormatter: (p) => formatPct(p.value) },
      { field: "fwd12", headerName: "Fwd 12M", valueFormatter: (p) => formatPct(p.value) },
      { field: "fwd24", headerName: "Fwd 24M", valueFormatter: (p) => formatPct(p.value) },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Historical Analysis</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">
          Point-in-time scanner. Peak, returns, and signals use only information available on the
          selected date. Future prices are never used to classify that date. Forward returns are
          labelled as subsequent outcomes, not inputs.
        </p>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <label className="text-sm">
          As of
          <Input
            type="date"
            className="mt-1"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={forward} onChange={(e) => setForward(e.target.checked)} />
          Show 6/12/24-month subsequent outcomes
        </label>
        <Button type="submit">Run historical scan</Button>
      </form>
      {m.data?.note ? <p className="text-xs text-mute">{m.data.note}</p> : null}
      <DataGrid rows={rows} columns={columns} height={560} pageSize={50} getRowId={(r) => String(r.indexId)} empty="Run a historical scan to fill the grid." />
    </div>
  );
}
