"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Pct, SignalBadge } from "@/components/signal-badge";
import { MfTable } from "@/components/mf-table";
import type { MfRow } from "@/services/mf-queries";

type Dash = {
  asOf: string | null;
  totals: { schemes: number; equity: number; debt: number; hybrid: number };
  market: { regime: string | null; below30: number; below40: number; recovering: number; falling: number; implication: string };
  cards: Record<string, MfRow | null>;
  lists: Record<string, MfRow[]>;
};

function Card({ label, row }: { label: string; row: MfRow | null }) {
  return (
    <div className="rounded border border-line bg-elev px-3 py-2">
      <div className="text-[11px] uppercase text-mute">{label}</div>
      {row ? (
        <>
          <Link href={`/mutual-funds/${row.id}`} className="mt-1 block text-sm font-medium hover:text-accent">
            {row.schemeName}
          </Link>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="num">{row.overallScore?.toFixed(1) ?? "—"}</span>
            <Pct value={row.cagr5y} />
          </div>
        </>
      ) : (
        <div className="mt-2 text-xs text-mute">Insufficient scored history</div>
      )}
    </div>
  );
}

export default function Page() {
  const q = useQuery({
    queryKey: ["mf-dashboard"],
    queryFn: () => fetch("/api/mutual-funds/dashboard").then((r) => r.json() as Promise<Dash>),
  });
  if (q.isLoading) return <p className="text-mute">Loading mutual-fund dashboard from local database…</p>;
  const d = q.data;
  if (!d) return <p className="text-neg">Mutual fund dashboard unavailable.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Mutual Fund Market</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">
          Research terminal for Indian mutual funds. Official AMFI NAV files are stored locally and scored in the
          background. This is not personalized advice and not a buy list.
        </p>
        <p className="mt-2 text-xs text-mute">
          As of {d.asOf ?? "—"}. Default screen Direct / Growth. Schemes {d.totals.schemes} · Equity {d.totals.equity} ·
          Debt {d.totals.debt} · Hybrid {d.totals.hybrid}.
        </p>
      </div>

      <section className="rounded border border-line bg-elev p-4">
        <div className="text-[11px] uppercase tracking-wide text-mute">Current market context (NSE engine)</div>
        <div className="mt-2 grid gap-3 md:grid-cols-5">
          <div>
            <div className="text-xs text-mute">Regime</div>
            <div>{d.market.regime ?? "n/a"}</div>
          </div>
          <div>
            <div className="text-xs text-mute">Sectors &gt;30% below ATH</div>
            <div className="num">{d.market.below30}</div>
          </div>
          <div>
            <div className="text-xs text-mute">Sectors &gt;40% below ATH</div>
            <div className="num">{d.market.below40}</div>
          </div>
          <div>
            <div className="text-xs text-mute">Recovering</div>
            <div className="num">{d.market.recovering}</div>
          </div>
          <div>
            <div className="text-xs text-mute">Falling</div>
            <div className="num">{d.market.falling}</div>
          </div>
        </div>
        <p className="mt-3 text-sm">
          <span className="text-mute">Mutual fund implication: </span>
          {d.market.implication}
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Card label="Best research score" row={d.cards.bestResearch} />
        <Card label="Best SIP candidate" row={d.cards.bestSip} />
        <Card label="Best Large Cap" row={d.cards.largeCap} />
        <Card label="Best Flexi Cap" row={d.cards.flexiCap} />
        <Card label="Best Mid Cap" row={d.cards.midCap} />
        <Card label="Best Small Cap" row={d.cards.smallCap} />
        <Card label="Best Index Fund" row={d.cards.index} />
        <Card label="Best Hybrid" row={d.cards.hybrid} />
        <Card label="Best Debt" row={d.cards.debt} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm uppercase tracking-wide text-mute">Top research candidates</h3>
          <MfTable rows={d.lists.research ?? []} />
        </section>
        <section>
          <h3 className="mb-2 text-sm uppercase tracking-wide text-mute">Best SIP (5Y XIRR)</h3>
          <MfTable rows={d.lists.sip ?? []} />
        </section>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm uppercase tracking-wide text-mute">
            Recovery <SignalBadge value="EARLY_RECOVERY_FUND" />
          </h3>
          <MfTable rows={d.lists.recovery ?? []} />
        </section>
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm uppercase tracking-wide text-mute">
            Falling knife <SignalBadge value="FALLING_KNIFE" />
          </h3>
          <MfTable rows={d.lists.falling ?? []} />
        </section>
      </div>
    </div>
  );
}
