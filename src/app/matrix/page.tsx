"use client";

import { useQuery } from "@tanstack/react-query";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { ScannerRow } from "@/lib/types";
import Link from "next/link";

export default function Page() {
  const q = useQuery({
    queryKey: ["matrix"],
    queryFn: () => fetch("/api/scanner").then((r) => r.json() as Promise<ScannerRow[]>),
  });
  const rows = q.data ?? [];
  const data = rows.map((r) => ({
    x: r.distanceFromAth,
    y: r.recoveryScore,
    name: r.name,
    signal: r.signal,
    id: r.indexId,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Signal Matrix</h2>
        <p className="mt-1 text-sm text-mute">
          X = distance from ATH. Y = recovery score. High drawdown + low recovery = falling knife.
          High drawdown + high recovery = recovery candidate.
        </p>
      </div>
      <div className="h-[480px] rounded border border-line bg-elev p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid stroke="var(--line)" />
            <XAxis dataKey="x" name="Drawdown" unit="%" stroke="var(--muted)" />
            <YAxis dataKey="y" name="Recovery" stroke="var(--muted)" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload;
                if (!p) return null;
                return (
                  <div className="rounded border border-line bg-bg px-2 py-1 text-xs">
                    {p.name}: DD {p.x.toFixed(1)}% · Rec {p.y.toFixed(0)} · {p.signal}
                  </div>
                );
              }}
            />
            <ReferenceLine x={40} stroke="var(--warn)" />
            <ReferenceLine y={50} stroke="var(--info)" />
            <Scatter data={data} fill="var(--accent)" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["Falling knife", rows.filter((r) => r.distanceFromAth >= 40 && r.recoveryScore < 50)],
          ["Recovery candidate", rows.filter((r) => r.distanceFromAth >= 40 && r.recoveryScore >= 50)],
          ["Strong", rows.filter((r) => r.distanceFromAth < 40 && r.recoveryScore >= 50)],
          ["Weak / Neutral", rows.filter((r) => r.distanceFromAth < 40 && r.recoveryScore < 50)],
        ].map(([label, list]) => (
          <section key={String(label)} className="rounded border border-line bg-elev p-3">
            <h3 className="mb-2 text-xs uppercase tracking-wide text-mute">{label as string}</h3>
            <ul className="space-y-1 text-sm">
              {(list as ScannerRow[]).map((r) => (
                <li key={r.indexId}>
                  <Link href={`/indices/${r.indexId}`} className="hover:text-accent">
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
