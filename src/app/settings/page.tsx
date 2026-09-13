"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export default function Page() {
  const q = useQuery({
    queryKey: ["config"],
    queryFn: () => fetch("/api/config").then((r) => r.json()),
  });
  const [json, setJson] = useState("");
  useEffect(() => {
    if (q.data?.settings) setJson(JSON.stringify(q.data.settings, null, 2));
  }, [q.data]);
  const save = useMutation({
    mutationFn: () =>
      fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: json,
      }).then((r) => r.json()),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Settings</h2>
      <p className="text-sm text-mute">
        Thresholds and score weights live in the database. Changing them does not require a code
        change. Primary scanner remains price return (PR). Total return (TR) is used only when an
        authorized TRI series is present. Local AI lives under <code>local_ai</code> — Ollama host and
        model names only. Leave model fields empty until you pull weights. No paid API is required.
      </p>
      <p className="text-xs text-mute">
        Active provider: {q.data?.provider} · Fallback: {q.data?.fallback}
      </p>
      <textarea
        className="h-[480px] w-full rounded border border-line bg-elev p-3 font-mono text-xs"
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />
      <button type="button" className="rounded bg-accent px-3 py-1.5 text-sm text-bg" onClick={() => save.mutate()}>
        Save settings
      </button>
      {save.data ? <p className="text-pos text-sm">Saved. Re-run daily ingest to recompute scores.</p> : null}
    </div>
  );
}
