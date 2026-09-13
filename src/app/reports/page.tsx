"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function Page() {
  const [kind, setKind] = useState<"daily" | "weekly" | "monthly">("daily");
  const q = useQuery({
    queryKey: ["brief", kind],
    queryFn: () => fetch(`/api/reports?kind=${kind}`).then((r) => r.json()),
  });
  const gen = useMutation({
    mutationFn: () => fetch(`/api/reports?kind=${kind}`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => q.refetch(),
  });
  const brief = q.data?.brief ?? gen.data;
  const body = brief?.body ?? gen.data?.body;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Intelligence reports</h2>
          <p className="mt-1 text-sm text-mute">Daily / weekly / monthly summaries from local scores. Not predictions.</p>
        </div>
        <div className="flex gap-2">
          {(["daily", "weekly", "monthly"] as const).map((k) => (
            <button key={k} type="button" className={`rounded px-2 py-1 text-sm ${kind === k ? "bg-accent text-bg" : "border border-line"}`} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
          <button type="button" className="rounded border border-line px-2 py-1 text-sm" onClick={() => gen.mutate()}>
            Generate
          </button>
        </div>
      </div>
      {body ? (
        <article className="space-y-3 rounded border border-line bg-elev p-4 text-sm">
          <h3 className="text-lg font-medium">{brief?.title ?? gen.data?.title}</h3>
          <p className="text-mute">{body.disclaimer}</p>
          <Section title="What is happening" text={JSON.stringify(body.whatIsHappening, null, 2)} />
          <Section title="Where is the stress" text={JSON.stringify(body.whereIsTheStress, null, 2)} />
          <Section title="Radar lists" text={(Object.entries(body.radarLists ?? {}) as [string, string[]][]).map(([k, v]) => `${k}: ${(v ?? []).join(", ") || "none"}`).join("\n")} />
        </article>
      ) : (
        <p className="text-mute">No brief stored yet. Generate after a successful NSE ingest, or click Generate.</p>
      )}
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <section>
      <h4 className="text-xs uppercase text-mute">{title}</h4>
      <pre className="mt-1 overflow-auto whitespace-pre-wrap text-xs">{text}</pre>
    </section>
  );
}
