"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function Page() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["alerts"],
    queryFn: () => fetch("/api/alerts").then((r) => r.json()),
  });
  const ack = useMutation({
    mutationFn: (id: number) => fetch("/api/alerts", { method: "POST", body: JSON.stringify({ id }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Alerts</h2>
      <div className="space-y-2">
        {(q.data ?? []).map((a: { id: number; date: string; severity: string; message: string; acknowledged: boolean; alertType: string }) => (
          <article key={a.id} className="flex items-start justify-between gap-3 rounded border border-line bg-elev p-3">
            <div>
              <div className="text-[11px] uppercase text-mute">
                {a.date} · {a.alertType} · {a.severity}
              </div>
              <p className="mt-1 text-sm">{a.message}</p>
            </div>
            {!a.acknowledged ? (
              <button type="button" className="text-xs text-accent" onClick={() => ack.mutate(a.id)}>
                Acknowledge
              </button>
            ) : (
              <span className="text-xs text-mute">Ack</span>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
