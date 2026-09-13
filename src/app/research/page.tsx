"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

export default function Page() {
  const [q, setQ] = useState("Which sectors are more than 40% below ATH but showing recovery?");
  const m = useMutation({
    mutationFn: () =>
      fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      }).then((r) => r.json()),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Research assistant</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">
          Answers only from application data. Translates the request into filters first. Does not invent prices, NAVs or BUY/SELL scores.
        </p>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <input className="min-w-[320px] flex-1 rounded border border-line bg-elev px-2 py-1 text-sm" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm text-bg">Ask</button>
      </form>
      {m.data?.filtersUsed ? (
        <pre className="overflow-auto rounded border border-line bg-elev p-3 text-xs">{JSON.stringify(m.data.filtersUsed, null, 2)}</pre>
      ) : null}
      {m.data?.note ? <p className="text-xs text-mute">{m.data.note}</p> : null}
      {m.data?.disclaimer ? <p className="text-xs text-mute">{m.data.disclaimer}</p> : null}
      <pre className="overflow-auto rounded border border-line p-3 text-xs">{m.data?.results ? JSON.stringify(m.data.results.slice(0, 15), null, 2) : ""}</pre>
    </div>
  );
}
