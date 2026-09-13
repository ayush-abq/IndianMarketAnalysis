"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pct, SignalBadge } from "@/components/signal-badge";

export default function Page() {
  const [form, setForm] = useState({
    monthlySip: "25000",
    horizon: "10+",
    riskTolerance: "Aggressive",
    categories: "",
  });
  const find = useMutation({
    mutationFn: () =>
      fetch("/api/mutual-funds/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlySip: Number(form.monthlySip),
          horizon: form.horizon,
          riskTolerance: form.riskTolerance,
          categories: form.categories ? form.categories.split(",").map((s) => s.trim()) : undefined,
        }),
      }).then((r) => r.json()),
  });
  const sip = useQuery({
    queryKey: ["sip-goal", form.monthlySip, form.horizon],
    queryFn: () => {
      const years = form.horizon === "lt1" ? 1 : form.horizon === "1-3" ? 3 : form.horizon === "3-5" ? 5 : form.horizon === "5-7" ? 7 : 10;
      return fetch(`/api/mutual-funds/sip-goal?monthly=${form.monthlySip}&years=${years}`).then((r) => r.json());
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Fund Research</h2>
        <p className="mt-1 text-sm text-mute">
          Find funds for further research. Output is a shortlist with reasons — not personalized financial advice.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <input className="rounded border border-line bg-elev px-2 py-1" value={form.monthlySip} onChange={(e) => setForm({ ...form, monthlySip: e.target.value })} placeholder="Monthly SIP" />
        <select className="rounded border border-line bg-elev px-2 py-1" value={form.horizon} onChange={(e) => setForm({ ...form, horizon: e.target.value })}>
          <option value="lt1">&lt;1 year</option>
          <option value="1-3">1–3 years</option>
          <option value="3-5">3–5 years</option>
          <option value="5-7">5–7 years</option>
          <option value="7-10">7–10 years</option>
          <option value="10+">10+ years</option>
        </select>
        <select className="rounded border border-line bg-elev px-2 py-1" value={form.riskTolerance} onChange={(e) => setForm({ ...form, riskTolerance: e.target.value })}>
          <option>Conservative</option>
          <option>Moderate</option>
          <option>Aggressive</option>
          <option>Very Aggressive</option>
        </select>
        <input className="rounded border border-line bg-elev px-2 py-1" value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} placeholder="Preferred categories (optional)" />
      </div>
      <button type="button" className="rounded bg-accent px-3 py-1.5 text-sm text-bg" onClick={() => find.mutate()}>
        Find funds for me
      </button>
      {sip.data ? (
        <section className="rounded border border-line bg-elev p-3 text-sm">
          <div className="text-[11px] uppercase text-mute">SIP goal calculator — assumed rates only</div>
          <p className="mt-1 text-xs text-warn">{sip.data.disclaimer}</p>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            {sip.data.scenarios?.map((s: { rate: number; invested: number; value: number; profit: number }) => (
              <div key={s.rate} className="rounded border border-line px-2 py-2">
                <div className="text-mute">{s.rate}% assumed</div>
                <div className="num">Value {Math.round(s.value).toLocaleString("en-IN")}</div>
                <div className="text-xs text-mute">Invested {Math.round(s.invested).toLocaleString("en-IN")}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {find.data?.disclaimer ? <p className="text-xs text-warn">{find.data.disclaimer}</p> : null}
      <div className="space-y-3">
        {find.data?.candidates?.map((c: { bucket: string; fund: { id: number; schemeName: string; category: string; overallScore: number | null; classification: string | null; cagr5y: number | null; sip5y: number | null; sharpe: number | null; maxDrawdown: number | null; expenseRatio: number | null }; why: string; risks: string[] }) => (
          <article key={`${c.bucket}-${c.fund.id}`} className="rounded border border-line bg-elev p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase text-mute">{c.bucket}</div>
                <Link href={`/mutual-funds/${c.fund.id}`} className="font-medium hover:text-accent">
                  {c.fund.schemeName}
                </Link>
                <div className="text-xs text-mute">{c.fund.category}</div>
              </div>
              <div className="text-right">
                <div className="num text-lg">{c.fund.overallScore?.toFixed(1) ?? "—"}</div>
                {c.fund.classification ? <SignalBadge value={c.fund.classification} /> : null}
              </div>
            </div>
            <p className="mt-2 text-sm">{c.why}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs">
              <span>5Y <Pct value={c.fund.cagr5y} /></span>
              <span>5Y SIP <Pct value={c.fund.sip5y} /></span>
              <span>Sharpe {c.fund.sharpe?.toFixed(2) ?? "—"}</span>
              <span>Max DD <Pct value={c.fund.maxDrawdown} /></span>
              <span>TER {c.fund.expenseRatio == null ? "—" : `${c.fund.expenseRatio.toFixed(2)}%`}</span>
            </div>
            <ul className="mt-2 list-disc pl-5 text-xs text-mute">
              {c.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
