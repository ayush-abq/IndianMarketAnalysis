"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScannerTable } from "./scanner-table";
import { Term } from "./term";
import { Button } from "@/components/ui/button";
import type { ScannerRow } from "@/lib/types";

type Props = {
  title: string;
  subtitle?: string;
  preset?: Record<string, string>;
};

export function ScannerPage({ title, subtitle, preset }: Props) {
  const [drawdown, setDrawdown] = useState(preset?.drawdown ?? "");
  const [y1, setY1] = useState(preset?.y1 ?? "");
  const [y2, setY2] = useState(preset?.y2 ?? "");
  const [y5, setY5] = useState(preset?.y5 ?? "");
  const [recovery, setRecovery] = useState(preset?.recovery ?? "");
  const [trend, setTrend] = useState(preset?.trend ?? "");
  const [signal, setSignal] = useState(preset?.signal ?? "");
  const [sort, setSort] = useState(preset?.sort ?? "drawdown");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (drawdown) p.set("drawdown", drawdown);
    if (y1) p.set("y1", y1);
    if (y2) p.set("y2", y2);
    if (y5) p.set("y5", y5);
    if (recovery) p.set("recovery", recovery);
    if (trend) p.set("trend", trend);
    if (signal) p.set("signal", signal);
    if (sort) p.set("sort", sort);
    return p.toString();
  }, [drawdown, y1, y2, y5, recovery, trend, signal, sort]);

  const q = useQuery({
    queryKey: ["scanner", qs],
    queryFn: () => fetch(`/api/scanner?${qs}`).then((r) => r.json() as Promise<ScannerRow[]>),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-mute">{subtitle}</p> : null}
          <p className="mt-1 text-xs text-mute">Hover a dotted table heading for what it means in plain English.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Button asChild variant="outline" size="sm"><a href={`/api/export?format=csv&${qs}`}>CSV</a></Button>
          <Button asChild variant="outline" size="sm"><a href={`/api/export?format=xlsx&${qs}`}>Excel</a></Button>
          <Button asChild variant="outline" size="sm"><a href={`/api/export?format=json&${qs}`}>JSON</a></Button>
          <Button asChild variant="outline" size="sm"><a href="/api/export?format=pdf">Report</a></Button>
        </div>
      </div>
      <div className="grid gap-2 rounded border border-line bg-elev p-3 text-xs md:grid-cols-4 lg:grid-cols-8">
        <Select term="drawdown" value={drawdown} onChange={setDrawdown} options={[["", "Any"], ["20", ">20%"], ["30", ">30%"], ["40", ">40%"], ["50", ">50%"], ["60", ">60%"]]} />
        <Select term="return1y" value={y1} onChange={setY1} options={[["", "Any"], ["0", "Negative"], ["-10", "<-10%"], ["-20", "<-20%"], ["-30", "<-30%"]]} />
        <Select term="return2y" value={y2} onChange={setY2} options={[["", "Any"], ["0", "Negative"], ["-20", "<-20%"], ["-30", "<-30%"], ["-50", "<-50%"]]} />
        <Select term="return5y" value={y5} onChange={setY5} options={[["", "Any"], ["0", "Negative"], ["-10", "<-10%"], ["-20", "<-20%"], ["-30", "<-30%"]]} />
        <Select term="recovery" value={recovery} onChange={setRecovery} options={[["", "Any"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]} />
        <Select term="technicalOverview" value={trend} onChange={setTrend} options={[["", "Any"], ["bullish", "Bullish"], ["neutral", "Neutral"], ["bearish", "Bearish"]]} />
        <Select term="signal" value={signal} onChange={setSignal} options={[["", "Any"], ["FALLING_KNIFE", "Falling knife"], ["EARLY_RECOVERY", "Early recovery"], ["STRUCTURAL_WEAKNESS", "Long-term weakness"], ["POSSIBLE_CAPITULATION", "Possible washout"], ["RECOVERING", "Recovering"], ["IMPROVING", "Improving"], ["WEAK_MOMENTUM", "Weak momentum"], ["STRONG", "Strong"]]} />
        <Select label="Sort" value={sort} onChange={setSort} options={[["drawdown", "Largest fall from peak"], ["y1", "Weakest 1-year return"], ["y2", "Weakest 2-year return"], ["y5", "Weakest 5-year return"], ["recovery", "Highest recovery"], ["opportunity", "Highest research score"], ["rs", "Worst vs peers"], ["recent_recovery", "Biggest recent repair"]]} />
      </div>
      <ScannerTable rows={q.data ?? []} />
    </div>
  );
}

function Select({
  label,
  term,
  value,
  onChange,
  options,
}: {
  label?: string;
  term?: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-mute">{term ? <Term id={term} /> : label}</span>
      <select
        className="w-full rounded border border-line bg-bg px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
