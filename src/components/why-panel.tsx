import type { MarketExplanation } from "@/services/explain";

export function WhyPanel({ title, explanation }: { title?: string; explanation: MarketExplanation | null | undefined }) {
  if (!explanation) return null;
  return (
    <section className="rounded border border-line bg-elev p-3">
      <h3 className="text-sm font-medium">{title ?? explanation.headline}</h3>
      <p className="mt-1 text-xs text-mute">
        Why this research label was assigned — from official prices or NAVs, not a headline we invented. Hover dotted words anywhere on the page for plain English.
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
        {explanation.because.map((b, i) => (
          <li key={`${i}-${b.slice(0, 24)}`}>{b}</li>
        ))}
      </ol>
      {explanation.against.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-warn">
          {explanation.against.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {explanation.news.length ? (
        <div className="mt-3 border-t border-line pt-2">
          <div className="text-[11px] uppercase text-mute">Events</div>
          <ul className="mt-1 space-y-1 text-sm">
            {explanation.news.map((n) => (
              <li key={`${n.date}-${n.headline}`}>
                {n.headline} <span className="text-xs text-mute">· {n.source} · {n.date}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
