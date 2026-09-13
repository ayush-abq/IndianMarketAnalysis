"use client";

import { useQuery } from "@tanstack/react-query";

export default function Page() {
  const q = useQuery({
    queryKey: ["changes"],
    queryFn: () => fetch("/api/changes").then((r) => r.json()),
  });
  const changes = q.data?.changes ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">What changed today</h2>
      <p className="text-sm text-mute">
        Comparing {q.data?.asOf ?? "—"} with previous snapshot {q.data?.previous ?? "—"}.
      </p>
      <div className="space-y-3">
        {changes.map((c: { name: string; type: string; previous: string; today: string; detail: string }, i: number) => (
          <article key={i} className="rounded border border-line bg-elev p-3">
            <div className="text-[11px] uppercase tracking-wide text-accent">{c.type}</div>
            <h3 className="mt-1 font-medium">{c.name}</h3>
            <p className="mt-1 text-sm text-mute">{c.detail}</p>
            <p className="num mt-2 text-sm">
              {c.previous} → {c.today}
            </p>
          </article>
        ))}
        {!changes.length ? <p className="text-mute">No day-over-day crossings yet. Snapshots are written after each successful ingest.</p> : null}
      </div>
    </div>
  );
}
