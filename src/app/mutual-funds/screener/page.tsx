"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MfTable } from "@/components/mf-table";
import type { MfRow } from "@/services/mf-queries";

export default function Page() {
  const [form, setForm] = useState({
    q: "",
    category: "",
    assetClass: "",
    plan: "DIRECT",
    option: "GROWTH",
    horizon: "",
    risk: "",
    minScore: "",
  });
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(form).filter(([, v]) => v)) as Record<string, string>,
  );
  params.set("limit", "50");
  const q = useQuery({
    queryKey: ["screener", params.toString()],
    queryFn: () => fetch(`/api/mutual-funds?${params}`).then((r) => r.json() as Promise<{ rows: MfRow[] }>),
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Fund Screener</h2>
      <p className="text-sm text-mute">Filters apply to precomputed category-relative research rows. Missing metrics stay blank.</p>
      <div className="grid gap-3 md:grid-cols-4">
        <input className="rounded border border-line bg-elev px-2 py-1 text-sm" placeholder="Name / AMC / ISIN / code" value={form.q} onChange={set("q")} />
        <input className="rounded border border-line bg-elev px-2 py-1 text-sm" placeholder="Category contains" value={form.category} onChange={set("category")} />
        <select className="rounded border border-line bg-elev px-2 py-1 text-sm" value={form.assetClass} onChange={set("assetClass")}>
          <option value="">All asset classes</option>
          {["Equity", "Debt", "Hybrid", "Index Fund", "ETF", "FoF", "Solution Oriented"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select className="rounded border border-line bg-elev px-2 py-1 text-sm" value={form.plan} onChange={set("plan")}>
          <option>DIRECT</option>
          <option>REGULAR</option>
        </select>
        <select className="rounded border border-line bg-elev px-2 py-1 text-sm" value={form.option} onChange={set("option")}>
          <option>GROWTH</option>
          <option>IDCW</option>
        </select>
        <select className="rounded border border-line bg-elev px-2 py-1 text-sm" value={form.horizon} onChange={set("horizon")}>
          <option value="">Horizon (optional)</option>
          <option value="lt1">&lt;1 year</option>
          <option value="1-3">1–3 years</option>
          <option value="3-5">3–5 years</option>
          <option value="5-7">5–7 years</option>
          <option value="7-10">7–10 years</option>
          <option value="10+">10+ years</option>
        </select>
        <select className="rounded border border-line bg-elev px-2 py-1 text-sm" value={form.risk} onChange={set("risk")}>
          <option value="">Risk filter (optional)</option>
          <option>Conservative</option>
          <option>Moderate</option>
          <option>Aggressive</option>
          <option>Very Aggressive</option>
        </select>
        <input className="rounded border border-line bg-elev px-2 py-1 text-sm" placeholder="Min research score" value={form.minScore} onChange={set("minScore")} />
      </div>
      {q.isLoading ? <p className="text-mute">Screening local database…</p> : <MfTable rows={q.data?.rows ?? []} />}
    </div>
  );
}
