"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MfTable } from "./mf-table";
import type { MfRow } from "@/services/mf-queries";

export function MfListPage({
  title,
  subtitle,
  endpoint,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
}) {
  const [plan, setPlan] = useState("DIRECT");
  const [option, setOption] = useState("GROWTH");
  const [limit, setLimit] = useState("20");
  const [q, setQ] = useState("");
  const url = useMemo(() => {
    const u = new URLSearchParams({ plan, option, limit });
    if (q) u.set("q", q);
    return `${endpoint}?${u}`;
  }, [endpoint, plan, option, limit, q]);
  const query = useQuery({
    queryKey: ["mf-list", url],
    queryFn: () => fetch(url).then((r) => r.json() as Promise<{ rows?: MfRow[]; disclaimer?: string; title?: string }>),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">{subtitle}</p>
        <p className="mt-2 text-xs text-mute">
          Default research screen: Direct / Growth. Direct and Regular are never mixed. Growth and IDCW are never mixed.
          Labels are research classifications, not advice.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <div className="text-[11px] uppercase text-mute">Plan</div>
          <select className="rounded border border-line bg-elev px-2 py-1" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option>DIRECT</option>
            <option>REGULAR</option>
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-[11px] uppercase text-mute">Option</div>
          <select className="rounded border border-line bg-elev px-2 py-1" value={option} onChange={(e) => setOption(e.target.value)}>
            <option>GROWTH</option>
            <option>IDCW</option>
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-[11px] uppercase text-mute">Show</div>
          <select className="rounded border border-line bg-elev px-2 py-1" value={limit} onChange={(e) => setLimit(e.target.value)}>
            <option>10</option>
            <option>20</option>
            <option>50</option>
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-[11px] uppercase text-mute">Search</div>
          <input className="rounded border border-line bg-elev px-2 py-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name / AMC / code" />
        </label>
        <a className="rounded border border-line px-2 py-1 text-xs" href={`/api/mutual-funds/export?plan=${plan}&option=${option}&format=csv`}>
          CSV
        </a>
        <a className="rounded border border-line px-2 py-1 text-xs" href={`/api/mutual-funds/export?plan=${plan}&option=${option}&format=xlsx`}>
          Excel
        </a>
      </div>
      {query.data?.disclaimer ? <p className="text-xs text-warn">{query.data.disclaimer}</p> : null}
      {query.isLoading ? <p className="text-mute">Loading precomputed mutual-fund rows…</p> : <MfTable rows={query.data?.rows ?? []} />}
    </div>
  );
}
