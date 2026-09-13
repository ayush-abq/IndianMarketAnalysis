"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type Row = Record<string, number | string | null>;

const METRICS = [
  ["d1", "1D"],
  ["m1", "1M"],
  ["m3", "3M"],
  ["m6", "6M"],
  ["y1", "1Y"],
  ["y2", "2Y"],
  ["y5", "5Y"],
  ["drawdown", "Drawdown"],
  ["recovery", "Recovery"],
  ["opportunity", "Opportunity"],
  ["rs", "Rel strength"],
] as const;

export default function Page() {
  const [metric, setMetric] = useState<(typeof METRICS)[number][0]>("y1");
  const q = useQuery({
    queryKey: ["heatmap"],
    queryFn: () => fetch("/api/heatmap").then((r) => r.json() as Promise<Row[]>),
  });
  const rows = q.data ?? [];
  const values = rows.map((r) => Number(r[metric] ?? 0)).filter(Number.isFinite);
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Sector Heatmap</h2>
      <div className="flex flex-wrap gap-2">
        {METRICS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMetric(key)}
            className={cn("rounded border px-2 py-1 text-xs", metric === key ? "border-accent text-accent" : "border-line text-mute")}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((r) => {
          const v = Number(r[metric]);
          const intensity = Number.isFinite(v) ? Math.min(1, Math.abs(v) / max) : 0;
          const neg = metric === "recovery" || metric === "opportunity" ? false : v < 0 || metric === "drawdown";
          return (
            <div
              key={String(r.name)}
              className="rounded border border-line px-3 py-3"
              style={{
                background: Number.isFinite(v)
                  ? `color-mix(in srgb, ${neg ? "var(--neg)" : "var(--pos)"} ${Math.round(intensity * 35)}%, var(--bg-elev))`
                  : "var(--bg-elev)",
              }}
            >
              <div className="text-sm font-medium">{r.name}</div>
              <div className="num mt-1 text-lg">
                {Number.isFinite(v) ? `${v.toFixed(1)}${["recovery", "opportunity"].includes(metric) ? "" : "%"}` : "Insufficient history"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
