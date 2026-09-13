"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RadarCards, RadarTable } from "@/components/radar-table";
import { Button } from "@/components/ui/button";

export default function Page() {
  const [mode, setMode] = useState("BALANCED");
  const q = useQuery({
    queryKey: ["radar", mode],
    queryFn: () => fetch(`/api/radar?mode=${mode}`).then((r) => r.json()),
  });
  if (q.isLoading) return <p className="text-mute">Loading opportunity radar from local scores…</p>;
  const d = q.data;
  if (!d) return <p className="text-neg">Radar unavailable.</p>;
  const lists = d.lists ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Daily Opportunity Radar</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">
          Unified research screens for sectors, stocks and mutual funds. Scores are explainable and historically testable in Strategy Lab.
          This is not a buy list.
        </p>
        <p className="mt-2 text-xs text-mute">
          As of {d.asOf ?? "—"} · {d.alphaModel?.version ?? d.modelVersion} · Mode {d.mode} · Regime {d.regime?.regime ?? "n/a"}
          {d.regime?.score != null ? ` (${Number(d.regime.score).toFixed(0)})` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["CONSERVATIVE", "BALANCED", "AGGRESSIVE"].map((m) => (
            <Button key={m} type="button" size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
              {m}
            </Button>
          ))}
        </div>
        {d.modeSpec ? <p className="mt-2 text-xs text-mute">{d.modeSpec.description}</p> : null}
        {d.systemicWarning ? <p className="mt-2 rounded border border-warn px-2 py-1 text-xs text-warn">{d.systemicWarning}</p> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <RadarCards title="Top quality + value" rows={lists.qualityValue ?? []} />
        <RadarCards title="Early recovery" rows={lists.earlyRecovery ?? []} />
        <RadarCards title="Deeply beaten down" rows={lists.beatenDown ?? []} />
        <RadarCards title="Earnings acceleration" rows={lists.earningsAcceleration ?? []} />
        <RadarCards title="Strong relative strength" rows={lists.relativeStrength ?? []} />
        <RadarCards title="QARP" rows={lists.qarp ?? []} />
        <RadarCards title="Mutual fund opportunities" rows={lists.topFunds ?? []} />
        <RadarCards title="Falling knives" rows={lists.fallingKnives ?? []} />
        <RadarCards title="Value traps" rows={lists.valueTraps ?? []} />
      </div>
      <section>
        <h3 className="mb-2 text-sm uppercase tracking-wide text-mute">Combined table</h3>
        <RadarTable rows={d.table ?? []} />
      </section>
    </div>
  );
}
