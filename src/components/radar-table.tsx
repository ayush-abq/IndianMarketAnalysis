"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { formatPct } from "@/lib/utils";
import type { RadarItem } from "@/services/opportunity-radar";
import { DataGrid } from "@/components/data-grid";
import { LinkCell, SignalCell, naValue } from "@/components/grid-cells";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RadarTable({ rows }: { rows: RadarItem[] }) {
  const [open, setOpen] = useState<RadarItem | null>(null);
  const columns = useMemo<ColDef<RadarItem>[]>(
    () => [
      { field: "name", minWidth: 200, flex: 1.2, cellRenderer: (p: ICellRendererParams<RadarItem>) => <LinkCell {...p} href={p.data?.href} /> },
      { field: "type", maxWidth: 110 },
      { field: "sector", valueFormatter: (p) => p.value ?? "N/A" },
      { field: "price", valueFormatter: naValue(2) },
      { field: "drawdown", valueFormatter: (p) => (p.value == null ? "N/A" : `${Number(p.value).toFixed(1)}%`) },
      { field: "return1y", valueFormatter: (p) => formatPct(p.value) },
      { field: "cagr3y", headerName: "3-year yearly rate", valueFormatter: (p) => formatPct(p.value) },
      { field: "cagr5y", headerName: "5-year yearly rate", valueFormatter: (p) => formatPct(p.value) },
      { field: "quality", valueFormatter: naValue(0) },
      { field: "valuation", valueFormatter: naValue(0) },
      { field: "earnings", valueFormatter: naValue(0) },
      { field: "momentum", valueFormatter: naValue(1) },
      { field: "recovery", valueFormatter: naValue(0) },
      { field: "relativeStrength", headerName: "vs peers", valueFormatter: naValue(1) },
      { field: "risk", valueFormatter: naValue(0) },
      { field: "opportunity", headerName: "Research score", valueFormatter: naValue(0) },
      { field: "classification", minWidth: 140, cellRenderer: SignalCell },
      {
        colId: "why",
        headerName: "Why",
        width: 110,
        sortable: false,
        filter: false,
        cellRenderer: (p: ICellRendererParams<RadarItem>) => (
          <Button type="button" variant="outline" size="sm" onClick={() => p.data && setOpen(p.data)}>
            Why?
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-3">
      <DataGrid
        rows={rows}
        columns={columns}
        height={560}
        pageSize={50}
        getRowId={(r) => `${r.type}-${r.id}`}
        empty="No names currently meet this screen."
      />
      {open ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>
                <Link href={open.href} className="hover:text-accent">
                  {open.name}
                </Link>
              </CardTitle>
              <CardDescription>Research candidate only. Requires further validation. Not a buy or sell instruction.</CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(null)}>
              Close
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs md:grid-cols-2">
            <div>
              <div className="font-medium">Reasons</div>
              <ul className="mt-1 list-disc pl-5">{open.why.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
            <div>
              <div className="font-medium">Risks</div>
              <ul className="mt-1 list-disc pl-5">{open.risks.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
            <p className="md:col-span-2 text-mute">
              Confluence {open.confluence != null ? open.confluence.toFixed(0) : "N/A"}
              {" · "}Aggressive {open.netAggressive != null ? open.netAggressive.toFixed(0) : "N/A"}
              (penalty {open.riskPenalty != null ? open.riskPenalty.toFixed(0) : "N/A"})
              {" · "}Stage {open.recoveryStageLabel ?? "N/A"}
              {open.missing?.length ? ` · N/A omitted from scores: ${open.missing.join(", ")}` : ""}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function RadarCards({ title, rows }: { title: string; rows: RadarItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {rows.slice(0, 10).map((r) => (
            <li key={`${r.type}-${r.id}`} className="flex items-baseline justify-between gap-2 text-sm">
              <Link href={r.href} className="truncate hover:text-accent">{r.name}</Link>
              <span className="num shrink-0 text-mute">{r.opportunity != null ? r.opportunity.toFixed(0) : "N/A"}</span>
            </li>
          ))}
          {!rows.length ? <li className="text-xs text-mute">No names currently meet this screen.</li> : null}
        </ul>
      </CardContent>
    </Card>
  );
}
