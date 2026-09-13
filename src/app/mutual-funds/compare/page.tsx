"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { formatPct } from "@/lib/utils";
import type { MfRow } from "@/services/mf-queries";
import { DataGrid } from "@/components/data-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CompareRow = { metric: string; [key: string]: string };

export default function Page() {
  const [raw, setRaw] = useState("");
  const ids = raw
    .split(/[,\s]+/)
    .map(Number)
    .filter(Number.isFinite)
    .slice(0, 5);
  const q = useQuery({
    queryKey: ["compare", ids.join(",")],
    enabled: ids.length >= 2,
    queryFn: () => fetch(`/api/mutual-funds/compare?ids=${ids.join(",")}`).then((r) => r.json()),
  });
  const search = useQuery({
    queryKey: ["mf-search-box"],
    queryFn: () => fetch("/api/mutual-funds?plan=DIRECT&option=GROWTH&limit=30").then((r) => r.json()),
  });
  const funds = (q.data?.funds as MfRow[] | undefined) ?? [];
  const rows = useMemo<CompareRow[]>(() => {
    if (!funds.length) return [];
    const metrics: [string, (f: MfRow) => string][] = [
      ["Category", (f) => f.category],
      ["Plan / option", (f) => `${f.plan} / ${f.option}`],
      ["Score", (f) => f.overallScore?.toFixed(1) ?? "—"],
      ["1-year return", (f) => formatPct(f.return1y)],
      ["3-year yearly rate", (f) => formatPct(f.cagr3y)],
      ["5-year yearly rate", (f) => formatPct(f.cagr5y)],
      ["5Y SIP", (f) => formatPct(f.sip5y)],
      ["Risk / reward", (f) => f.sharpe?.toFixed(2) ?? "—"],
      ["Worst fall", (f) => formatPct(f.maxDrawdown)],
      ["TER", (f) => (f.expenseRatio == null ? "—" : `${f.expenseRatio.toFixed(2)}%`)],
      ["Research label", (f) => f.classification?.replaceAll("_", " ") ?? "—"],
    ];
    return metrics.map(([metric, cell]) => {
      const row: CompareRow = { metric };
      for (const f of funds) row[`f${f.id}`] = cell(f);
      return row;
    });
  }, [funds]);
  const columns = useMemo<ColDef<CompareRow>[]>(
    () => [
      { field: "metric", headerName: "Metric", pinned: "left", minWidth: 160 },
      ...funds.map((f) => ({
        field: `f${f.id}`,
        headerName: f.schemeName.slice(0, 32),
        minWidth: 160,
        flex: 1,
      })),
    ],
    [funds],
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Fund Comparison</h2>
      <p className="text-sm text-mute">Compare up to 5 funds. Paste IDs from the screener, or pick from the Direct Growth shortlist.</p>
      <Input
        placeholder="Fund IDs, comma-separated"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />
      <div className="flex flex-wrap gap-2 text-xs">
        {(search.data?.rows as MfRow[] | undefined)?.slice(0, 12).map((r) => (
          <Button
            key={r.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRaw((v) => (v ? `${v},${r.id}` : String(r.id)))}
          >
            {r.schemeName.slice(0, 40)}
          </Button>
        ))}
      </div>
      {q.data?.overlap?.note ? <p className="text-xs text-warn">{q.data.overlap.note}</p> : null}
      {q.data?.overlap?.overlapPct != null ? (
        <p className="text-sm">
          Pairwise overlap: <span className="num">{q.data.overlap.overlapPct.toFixed(1)}%</span>
          {q.data.overlap.overlapPct >= 40 ? <span className="ml-2 text-warn">High overlap</span> : null}
        </p>
      ) : null}
      <DataGrid
        rows={rows}
        columns={columns}
        height={480}
        pagination={false}
        empty="Pick at least two fund IDs to compare official NAV history."
      />
    </div>
  );
}
