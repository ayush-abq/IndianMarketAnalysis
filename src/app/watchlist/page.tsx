"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

export default function Page() {
  const q = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => fetch("/api/watchlist").then((r) => r.json()),
  });
  const refresh = useMutation({
    mutationFn: () => fetch("/api/thesis", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => q.refetch(),
  });
  const remove = useMutation({
    mutationFn: (id: number) => fetch(`/api/watchlist?id=${id}`, { method: "DELETE" }),
    onSuccess: () => q.refetch(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Watchlist &amp; thesis tracker</h2>
          <p className="mt-1 text-sm text-mute">Monitor conditions you wrote down. Failed conditions mark the thesis as deteriorating.</p>
        </div>
        <button type="button" className="rounded bg-accent px-3 py-1.5 text-sm text-bg" onClick={() => refresh.mutate()}>
          Refresh thesis checks
        </button>
      </div>
      <div className="space-y-3">
        {(q.data?.items ?? []).map((item: Record<string, unknown>) => (
          <article key={String(item.id)} className="rounded border border-line bg-elev p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase text-accent">{String(item.assetType)} · {String(item.status)}</div>
                <h3 className="font-medium">{String(item.assetName)}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-mute">{String(item.thesis ?? "No thesis recorded.")}</p>
              </div>
              <button type="button" className="text-xs text-mute" onClick={() => remove.mutate(Number(item.id))}>Remove</button>
            </div>
            <p className="mt-2 text-xs">Thesis status: {String(item.thesisStatus)}</p>
            <ul className="mt-1 list-disc pl-5 text-xs text-mute">
              {((item.checks as { condition: string; status: string; detail: string | null }[]) ?? []).slice(-6).map((c, i) => (
                <li key={i}>{c.condition}: {c.status} — {c.detail}</li>
              ))}
            </ul>
          </article>
        ))}
        {!q.data?.items?.length ? <p className="text-sm text-mute">Empty. Add names from a sector, stock or fund page.</p> : null}
      </div>
    </div>
  );
}
