"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Term } from "./term";

const PRIMARY_NAV = [
  { href: "/", label: "Today" },
  { href: "/scanner", label: "Sectors" },
  { href: "/mutual-funds", label: "Funds" },
  { href: "/stocks", label: "Stocks" },
  { href: "/horizons", label: "Horizons" },
  { href: "/structure", label: "Breakouts" },
  { href: "/data-health", label: "Data" },
];

const MORE_NAV: { heading: string; items: { href: string; label: string }[] }[] = [
  {
    heading: "Research",
    items: [
      { href: "/horizons", label: "Horizon research" },
      { href: "/radar", label: "Opportunity Radar" },
      { href: "/recovery", label: "Recovery" },
      { href: "/falling-knives", label: "Falling knives" },
      { href: "/extreme-drawdowns", label: "Deep drawdowns" },
      { href: "/heatmap", label: "Heatmap" },
      { href: "/changes", label: "What changed" },
    ],
  },
  {
    heading: "Funds",
    items: [
      { href: "/mutual-funds/best", label: "Best funds" },
      { href: "/mutual-funds/best-sip", label: "Best SIP" },
      { href: "/mutual-funds/screener", label: "Screener" },
      { href: "/mutual-funds/compare", label: "Compare" },
      { href: "/mutual-funds/quality", label: "Quality / cost" },
    ],
  },
  {
    heading: "Tools",
    items: [
      { href: "/local-ai", label: "Local AI / ML" },
      { href: "/strategy-lab", label: "Strategy Lab" },
      { href: "/watchlist", label: "Watchlist" },
      { href: "/paper", label: "Paper" },
      { href: "/data-health", label: "Data coverage" },
      { href: "/settings", label: "Settings" },
      { href: "/glossary", label: "Terms explained" },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setMoreOpen(false), [path]);
  const health = useQuery({
    queryKey: ["data-health"],
    queryFn: () => fetch("/api/data-health").then((r) => r.json()),
  });

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-elev/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] tracking-[0.18em] text-accent uppercase">Indian market research</div>
            <h1 className="text-lg font-semibold leading-snug">What&apos;s constructive — sectors, funds, stocks</h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-mute">
            <div className="leading-relaxed">
              Last update <span className="num text-ink">{health.data?.lastSuccessfulIngestion ?? "—"}</span>
              <span className="mx-1.5">·</span>
              Data through <span className="num text-ink">{health.data?.latestTradingDate ?? "—"}</span>
              {health.data?.mf?.nav?.latest ? (
                <>
                  <span className="mx-1.5">·</span>
                  MF NAV <span className="num text-ink">{health.data.mf.nav.latest}</span>
                </>
              ) : null}
              {health.data?.stale ? (
                <span className="ml-2 rounded border border-warn px-1.5 py-0.5 text-warn">DATA STALE</span>
              ) : null}
            </div>
            <span className="rounded border border-line px-1.5 py-0.5">
              <Term id="pr" className="text-xs" />
            </span>
            <Link href="/glossary" className="rounded border border-line px-1.5 py-0.5 hover:text-accent">
              Terms
            </Link>
            <button
              type="button"
              onClick={() => setTheme((resolvedTheme ?? theme) === "dark" ? "light" : "dark")}
              className="rounded border border-line p-1.5"
              aria-label="Toggle theme"
            >
              {!mounted ? (
                <span className="block h-3.5 w-3.5" />
              ) : (resolvedTheme ?? theme) === "light" ? (
                <Moon size={14} />
              ) : (
                <Sun size={14} />
              )}
            </button>
          </div>
        </div>
        <nav className="border-t border-line bg-elev">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2">
            {PRIMARY_NAV.map((item) => {
              const active =
                item.href === "/"
                  ? path === "/"
                  : path === item.href || (item.href !== "/" && path.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-md px-3.5 py-2 text-sm font-medium",
                    active ? "bg-accent text-bg" : "bg-mutedbg text-ink hover:bg-line/40",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="relative">
              <button
                type="button"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-md px-3.5 py-2 text-sm font-medium",
                  moreOpen ? "bg-accent text-bg" : "bg-mutedbg text-ink hover:bg-line/40",
                )}
              >
                More
              </button>
              {moreOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="Close more menu"
                    className="fixed inset-0 z-40 cursor-default bg-transparent"
                    onClick={() => setMoreOpen(false)}
                  />
                  <div className="absolute left-0 z-50 mt-2 w-[min(40rem,calc(100vw-2rem))] rounded-md border border-line bg-elev p-4 shadow-lg">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {MORE_NAV.map((group) => (
                        <div key={group.heading}>
                          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-mute">{group.heading}</div>
                          {group.items.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "block rounded px-2 py-1.5 text-sm hover:bg-mutedbg",
                                path === item.href || path.startsWith(`${item.href}/`) ? "text-accent" : "text-ink",
                              )}
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-5">{children}</main>
    </div>
  );
}
