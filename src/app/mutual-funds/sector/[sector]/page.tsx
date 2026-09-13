"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Pct, SignalBadge } from "@/components/signal-badge";
import { MfTable } from "@/components/mf-table";

export default function Page() {
  const params = useParams<{ sector: string }>();
  const sector = decodeURIComponent(params.sector);
  const q = useQuery({
    queryKey: ["mf-sector", sector],
    queryFn: () => fetch(`/api/mutual-funds/sector/${encodeURIComponent(sector)}`).then((r) => r.json()),
  });
  const s = q.data?.sector;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Sector → Mutual Funds · {sector}</h2>
      {s ? (
        <div className="rounded border border-line bg-elev p-3 text-sm">
          <Link href={`/indices/${s.indexId}`} className="font-medium hover:text-accent">
            {s.name}
          </Link>
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            <span>Below ATH <Pct value={-s.distanceFromAth} /></span>
            <span>1Y <Pct value={s.return1y} /></span>
            <span>Recovery {s.recoveryScore}</span>
            <SignalBadge value={s.signal} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-mute">NSE sector snapshot unavailable for this name — funds still listed from category mapping.</p>
      )}
      <p className="text-xs text-mute">
        Exposure uses official holdings when present; otherwise a labelled category proxy (e.g. a sectoral IT fund → Nifty IT).
      </p>
      <MfTable rows={q.data?.funds ?? []} />
    </div>
  );
}
