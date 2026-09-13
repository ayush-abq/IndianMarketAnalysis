"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/data-grid";
import { WhyCell } from "@/components/grid-cells";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Position = {
  id: number;
  assetName: string;
  entryDate: string;
  entryPrice: number;
  exitDate?: string | null;
  exitPrice?: number | null;
  reason?: string | null;
};

export default function Page() {
  const q = useQuery({
    queryKey: ["paper"],
    queryFn: () => fetch("/api/paper").then((r) => r.json()),
  });
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const add = useMutation({
    mutationFn: () =>
      fetch("/api/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType: "SECTOR",
          assetId: 0,
          assetName: name,
          quantity: 1,
          entryDate: new Date().toISOString().slice(0, 10),
          entryPrice: Number(price),
          reason: "Paper research entry — not live capital.",
        }),
      }),
    onSuccess: () => q.refetch(),
  });
  const rows = (q.data?.positions ?? []) as Position[];
  const columns = useMemo<ColDef<Position>[]>(
    () => [
      { field: "assetName", headerName: "Asset", minWidth: 180, flex: 1 },
      {
        colId: "entry",
        headerName: "Entry",
        minWidth: 180,
        valueGetter: (p) => (p.data ? `${p.data.entryDate} @ ${p.data.entryPrice}` : ""),
      },
      {
        colId: "exit",
        headerName: "Exit",
        minWidth: 160,
        valueGetter: (p) => (p.data?.exitDate ? `${p.data.exitDate} @ ${p.data.exitPrice}` : "Open"),
      },
      { field: "reason", headerName: "Reason", minWidth: 240, flex: 1.2, cellRenderer: WhyCell },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Paper portfolio</h2>
        <p className="mt-1 text-sm text-mute">Simulated research book. No live orders. Track entry context and later outcomes.</p>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Input className="max-w-xs" placeholder="Asset name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input className="max-w-[10rem]" placeholder="Entry reference" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Button type="submit">Add paper line</Button>
      </form>
      <DataGrid rows={rows} columns={columns} height={420} pageSize={25} getRowId={(r) => String(r.id)} empty="No paper lines yet." />
    </div>
  );
}
