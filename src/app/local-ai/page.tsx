"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";

export default function Page() {
  const status = useQuery({
    queryKey: ["local-ai-status"],
    queryFn: () => fetch("/api/local-ai/status").then((r) => r.json()),
  });
  const perf = useQuery({
    queryKey: ["local-ai-perf"],
    queryFn: () => fetch("/api/local-ai/performance").then((r) => r.json()),
  });
  const train = useMutation({
    mutationFn: () =>
      fetch("/api/local-ai/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: "NIFTY500", limit: 80, every: 21 }),
      }).then((r) => r.json()),
    onSuccess: () => {
      status.refetch();
      perf.refetch();
    },
  });
  const features = useMutation({
    mutationFn: () => fetch("/api/local-ai/features", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()),
  });

  const s = status.data;
  const p = perf.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Local AI / ML research engine</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">
          Four brains: quant rules, ML probabilities, local LLM analyst, local LLM critic. Combined by a fifth
          opportunity blender. Ollama only. API cost ₹0. Models are never auto-downloaded. Predictions stay N/A until you train.
        </p>
      </div>

      {status.isLoading ? <p className="text-mute">Reading hardware and Ollama…</p> : null}

      <section className="grid gap-3 md:grid-cols-3">
        <Card title="Hardware" body={s ? `${s.hardware?.recommendedTier} · ${s.hardware?.ramGb} GB RAM · ${s.hardware?.recommendedSize}` : "—"} extra={s?.hardware?.note} />
        <Card title="Ollama" body={s?.ollama?.reachable ? `${s.ollama.models.length} local models` : s?.ollama?.error ?? "Not running"} extra={s?.ollama?.baseUrl} />
        <Card title="Registry" body={`${s?.registry?.length ?? 0} stored versions`} extra="Status EXPERIMENTAL until you promote one." />
      </section>

      <section className="rounded border border-line bg-elev p-3 text-sm">
        <h3 className="text-sm font-medium">Assigned local models</h3>
        <ul className="mt-2 grid gap-1 md:grid-cols-2 text-xs">
          <li>Analyst: {s?.resolvedModels?.analyst || "not set"}</li>
          <li>Critic / reasoner: {s?.resolvedModels?.critic || "not set"}</li>
          <li>Synthesizer: {s?.resolvedModels?.synthesizer || "not set"}</li>
          <li>Fast: {s?.resolvedModels?.fast || "not set"}</li>
        </ul>
        <p className="mt-2 text-xs text-mute">
          Pull yourself, then set <code>AI_MODEL_ANALYST</code> / Settings <code>local_ai</code>. Example:{" "}
          <code>ollama pull qwen2.5:7b</code>
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded bg-accent px-3 py-1.5 text-sm text-bg disabled:opacity-50" disabled={train.isPending} onClick={() => train.mutate()}>
          {train.isPending ? "Training walk-forward…" : "Train local ML (Nifty 500 sample)"}
        </button>
        <button type="button" className="rounded border border-line px-3 py-1.5 text-sm" disabled={features.isPending} onClick={() => features.mutate()}>
          Materialize feature store
        </button>
        <Link className="rounded border border-line px-3 py-1.5 text-sm" href="/settings">
          Settings
        </Link>
        <Link className="rounded border border-line px-3 py-1.5 text-sm" href="/strategy-lab">
          Strategy Lab
        </Link>
      </div>
      {train.data ? (
        <pre className="overflow-auto rounded border border-line bg-elev p-3 text-xs">{JSON.stringify(train.data, null, 2)}</pre>
      ) : null}

      <section className="rounded border border-line bg-elev p-3">
        <h3 className="text-sm font-medium">AI performance</h3>
        <p className="mt-1 text-xs text-mute">{p?.note}</p>
        <div className="mt-2 grid gap-2 md:grid-cols-4 text-sm">
          <Metric k="Predictions stored" v={String(p?.predictionCount ?? 0)} />
          <Metric k="Forward-filled" v={String(p?.scoredCount ?? 0)} />
          <Metric k="Hit rate" v={p?.classification?.accuracy != null ? `${(p.classification.accuracy * 100).toFixed(0)}%` : "N/A"} />
          <Metric k="Decay" v={p?.decay?.status ?? "N/A"} />
        </div>
        <p className="mt-2 text-xs text-mute">{p?.decay?.note}</p>
      </section>

      <section className="rounded border border-line bg-elev p-3 text-sm">
        <h3 className="text-sm font-medium">Model cards</h3>
        <ul className="mt-2 divide-y divide-line/60">
          {(s?.registry ?? []).map((m: { id: number; modelId: string; target: string; version: string; status: string; limitations?: string }) => (
            <li key={m.id} className="py-2">
              <div className="font-medium">
                {m.modelId} · {m.target} · {m.version}
              </div>
              <div className="text-xs text-mute">{m.status} — {m.limitations}</div>
            </li>
          ))}
          {!s?.registry?.length ? <li className="py-2 text-mute">No trained models yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}

function Card({ title, body, extra }: { title: string; body: string; extra?: string }) {
  return (
    <div className="rounded border border-line bg-elev px-3 py-2">
      <div className="text-[11px] uppercase text-mute">{title}</div>
      <div className="mt-1 text-sm">{body}</div>
      {extra ? <p className="mt-1 text-xs text-mute">{extra}</p> : null}
    </div>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-mute">{k}</div>
      <div className="num">{v}</div>
    </div>
  );
}
