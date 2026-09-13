"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { MfRow } from "@/services/mf-queries";

export default function Page() {
  const [legs, setLegs] = useState<{ id: number; weight: number; name: string }[]>([]);
  const funds = useQuery({
    queryKey: ["mf-port-search"],
    queryFn: () => fetch("/api/mutual-funds?plan=DIRECT&option=GROWTH&limit=40").then((r) => r.json()),
  });
  const run = useMutation({
    mutationFn: () =>
      fetch("/api/mutual-funds/overlap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legs: legs.map(({ id, weight }) => ({ id, weight })) }),
      }).then((r) => r.json()),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Portfolio Analyzer</h2>
      <p className="text-sm text-mute">
        Hypothetical blend. Weighted sector exposure and overlap use official holdings when present; otherwise the
        system says so. Not an allocation recommendation.
      </p>
      <div className="flex flex-wrap gap-2">
        {(funds.data?.rows as MfRow[] | undefined)?.slice(0, 16).map((f) => (
          <button
            key={f.id}
            type="button"
            className="rounded border border-line px-2 py-1 text-xs"
            onClick={() => setLegs((xs) => (xs.find((x) => x.id === f.id) ? xs : [...xs, { id: f.id, weight: 25, name: f.schemeName }]))}
          >
            + {f.schemeName.slice(0, 36)}
          </button>
        ))}
      </div>
      {legs.map((l, i) => (
        <div key={l.id} className="flex items-center gap-3 text-sm">
          <div className="flex-1 truncate">{l.name}</div>
          <input
            type="number"
            className="w-24 rounded border border-line bg-elev px-2 py-1"
            value={l.weight}
            onChange={(e) =>
              setLegs((xs) => xs.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))
            }
          />
          <button type="button" className="text-neg" onClick={() => setLegs((xs) => xs.filter((x) => x.id !== l.id))}>
            remove
          </button>
        </div>
      ))}
      <button type="button" className="rounded border border-line px-3 py-1.5 text-sm" onClick={() => run.mutate()} disabled={legs.length < 1}>
        Analyze blend
      </button>
      {run.data ? (
        <div className="space-y-2 rounded border border-line bg-elev p-3 text-sm">
          <p>{run.data.disclaimer}</p>
          {run.data.overlapWarning ? <p className="text-warn">{run.data.overlapWarning}</p> : null}
          <p>
            Diversification score <span className="num">{run.data.diversificationScore?.toFixed?.(0) ?? "—"}</span> ·
            Weighted TER <span className="num">{run.data.weightedExpense?.toFixed?.(2) ?? "—"}</span> · Weighted max DD{" "}
            <span className="num">{run.data.weightedMaxDrawdown?.toFixed?.(1) ?? "—"}</span>
          </p>
          {run.data.overlap?.common?.length ? (
            <ul className="text-xs">
              {run.data.overlap.common.slice(0, 8).map((c: { name: string; minWeight: number }) => (
                <li key={c.name}>
                  {c.name} · common weight {c.minWeight.toFixed(1)}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-mute">{run.data.overlap?.note ?? "No official holdings overlap available."}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
