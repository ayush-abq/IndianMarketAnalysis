"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MfTable } from "@/components/mf-table";

export default function Page() {
  const [asOf, setAsOf] = useState("2020-01-01");
  const q = useQuery({
    queryKey: ["mf-backtest", asOf],
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(asOf),
    queryFn: () => fetch(`/api/mutual-funds/backtest?asOf=${asOf}&plan=DIRECT&option=GROWTH&limit=30`).then((r) => r.json()),
  });
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Historical Fund Scanner</h2>
      <p className="text-sm text-mute">
        As-of ranking uses only scores stored for that date (information available then). Later NAVs are not used.
        Merged/closed schemes remain if they were ingested.
      </p>
      <input className="rounded border border-line bg-elev px-2 py-1" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
      {q.data?.note ? <p className="text-xs text-warn">{q.data.note}</p> : null}
      <MfTable rows={q.data?.rows ?? []} />
    </div>
  );
}
