import Link from "next/link";
import type { ScannerRow } from "@/lib/types";
import { Pct, SignalBadge } from "./signal-badge";

export function TopList({ title, rows }: { title: string; rows: ScannerRow[] }) {
  return (
    <section className="rounded border border-line bg-elev">
      <header className="border-b border-line px-3 py-2 text-xs uppercase tracking-wide text-mute">{title}</header>
      <ul>
        {rows.map((r) => (
          <li key={r.indexId} className="flex items-center justify-between gap-3 border-b border-line/60 px-3 py-2 last:border-0">
            <div>
              <Link href={`/indices/${r.indexId}`} className="text-sm font-medium hover:text-accent">
                {r.name}
              </Link>
              <div className="mt-1">
                <SignalBadge value={r.signal} />
              </div>
            </div>
            <div className="text-right text-xs">
              <div><Pct value={-r.distanceFromAth} /></div>
              <div className="text-mute">1Y <Pct value={r.return1y} /></div>
            </div>
          </li>
        ))}
        {!rows.length ? <li className="px-3 py-4 text-sm text-mute">No names currently qualify.</li> : null}
      </ul>
    </section>
  );
}
