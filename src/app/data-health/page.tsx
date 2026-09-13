"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Engine = {
  id: string;
  title: string;
  what: string;
  lastAdded: string;
  lastStatus: string;
  dataThrough: string | null;
  nextAdd: string;
  nextHint: string;
  extra?: string;
};

type Control = {
  now: string;
  expectedSession: string;
  busy: boolean;
  job: {
    kind: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    steps: { engine: string; status: string; note?: string }[];
    error?: string;
  } | null;
  runningJobs: { provider: string; jobKey: string | null; startedAt: string }[];
  engines: Engine[];
  actions: {
    today: { label: string; time: string; when: string };
    history: { label: string; time: string; when: string };
  };
  worker: string;
  accepted?: boolean;
  reason?: string;
};

export default function Page() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["ingest-control"],
    queryFn: () => fetch("/api/ingest-control").then((r) => r.json() as Promise<Control>),
    refetchInterval: (query) => (query.state.data?.busy ? 4000 : 20_000),
  });
  const health = useQuery({
    queryKey: ["data-health"],
    queryFn: () => fetch("/api/data-health").then((r) => r.json()),
  });
  const run = useMutation({
    mutationFn: (kind: "today" | "history") =>
      fetch("/api/ingest-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      }).then((r) => r.json() as Promise<Control>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingest-control"] });
      qc.invalidateQueries({ queryKey: ["data-health"] });
    },
  });
  const d = q.data;
  const coverage = health.data?.coverage;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Update data</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">
          Official NSE and AMFI files are saved here, then scores are calculated. The screens never invent a price or NAV.
          You do not need the terminal for a normal refresh.
        </p>
        <p className="mt-2 text-xs text-mute">Now {d?.now ?? "…"} · Latest cash session we expect: {d?.expectedSession ?? "—"}</p>
      </div>

      {d?.busy ? (
        <div className="rounded border border-warn/50 bg-elev px-3 py-2 text-sm text-warn">
          {d.job?.status === "running"
            ? d.job.kind === "history"
              ? "History is loading. Leave this page open or come back later — already-saved days are skipped."
              : "Latest files are being fetched. This usually finishes in a few minutes."
            : "Another load is already running. Wait until it finishes before starting another."}
          {d.runningJobs?.[0] ? (
            <div className="mt-1 text-xs">
              In progress: {d.runningJobs[0].provider} · {d.runningJobs[0].jobKey} · started {d.runningJobs[0].startedAt}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          disabled={d?.busy || run.isPending}
          onClick={() => run.mutate("today")}
          className="rounded-md bg-accent px-4 py-4 text-left text-bg disabled:opacity-50"
        >
          <div className="text-base font-semibold">{d?.actions.today.label ?? "Update latest files"}</div>
          <p className="mt-1 text-sm opacity-90">{d?.actions.today.when}</p>
          <p className="mt-2 text-xs opacity-80">{d?.actions.today.time}</p>
        </button>
        <button
          type="button"
          disabled={d?.busy || run.isPending}
          onClick={() => run.mutate("history")}
          className="rounded-md border border-line bg-elev px-4 py-4 text-left disabled:opacity-50"
        >
          <div className="text-base font-semibold">{d?.actions.history.label ?? "Fill missing history"}</div>
          <p className="mt-1 text-sm text-mute">{d?.actions.history.when}</p>
          <p className="mt-2 text-xs text-mute">{d?.actions.history.time}</p>
        </button>
      </div>
      {run.data?.reason ? <p className="text-sm text-warn">{run.data.reason}</p> : null}

      {d?.job ? (
        <section className="rounded border border-line bg-elev p-3">
          <h3 className="text-sm font-medium">This run</h3>
          <p className="mt-1 text-xs text-mute">
            {d.job.kind === "history" ? "History" : "Latest files"} · {d.job.status}
            {d.job.finishedAt ? " · finished" : " · running"}
          </p>
          <ol className="mt-2 space-y-1 text-sm">
            {d.job.steps.map((s) => (
              <li key={s.engine}>
                {s.engine}: <span className="text-mute">{s.note ?? s.status}</span>
              </li>
            ))}
            {d.job.status === "running" && !d.job.steps.length ? <li className="text-mute">Starting…</li> : null}
          </ol>
          {d.job.error ? <p className="mt-2 text-sm text-neg">{d.job.error}</p> : null}
        </section>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-3">
        {(d?.engines ?? []).map((e) => (
          <article key={e.id} className="rounded border border-line bg-elev p-3">
            <h3 className="text-sm font-medium">{e.title}</h3>
            <p className="mt-1 text-xs text-mute">{e.what}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-[11px] uppercase text-mute">Last added</dt>
                <dd>{e.lastAdded}</dd>
                <dd className="text-xs text-mute">Status: {e.lastStatus}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-mute">Data in the database through</dt>
                <dd className="num">{e.dataThrough ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-mute">Next automatic add</dt>
                <dd>{e.nextAdd}</dd>
                <dd className="mt-0.5 text-xs text-mute">{e.nextHint}</dd>
                {e.extra ? <dd className="mt-0.5 text-xs text-mute">{e.extra}</dd> : null}
              </div>
            </dl>
          </article>
        ))}
      </section>

      <p className="text-xs text-mute">{d?.worker}</p>

      {coverage?.blocks ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">How complete is the store?</h3>
          <p className="text-sm text-mute">{coverage.note}</p>
          <div className="grid gap-3 lg:grid-cols-3">
            {coverage.blocks.map((b: { name: string; status: string; summary: string; rows: Record<string, string | number | null>; missing: string[] }) => (
              <div key={b.name} className="rounded border border-line bg-elev p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">{b.name}</h4>
                  <span className={`text-[10px] uppercase ${b.status === "READY" ? "text-pos" : b.status === "PARTIAL" ? "text-warn" : "text-neg"}`}>
                    {b.status === "READY" ? "Enough for analysis" : b.status === "PARTIAL" ? "Still filling" : "Empty"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-mute">{b.summary}</p>
                <dl className="mt-2 space-y-1 text-xs">
                  {Object.entries(b.rows).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-mute">{k}</dt>
                      <dd className="num">{v == null ? "—" : String(v)}</dd>
                    </div>
                  ))}
                </dl>
                {b.missing?.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-warn">
                    {b.missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
