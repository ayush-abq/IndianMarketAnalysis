import type { DashboardSummary } from "@/lib/types";

export function SummaryCards({ dash }: { dash: DashboardSummary }) {
  const items = [
    ["Total indices", dash.totals.indices],
    [">30% below ATH", dash.totals.below30],
    [">40% below ATH", dash.totals.below40],
    [">50% below ATH", dash.totals.below50],
    ["Negative 1Y", dash.totals.neg1y],
    ["Negative 2Y", dash.totals.neg2y],
    ["Negative 5Y", dash.totals.neg5y],
    ["Recovery candidates", dash.totals.recoveryCandidates],
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {items.map(([label, value]) => (
        <div key={label} className="rounded border border-line bg-elev px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-mute">{label}</div>
          <div className="num mt-1 text-2xl">{value}</div>
        </div>
      ))}
    </div>
  );
}
