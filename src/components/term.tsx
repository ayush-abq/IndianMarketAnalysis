"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
import { glossaryEntry, termLabel } from "@/lib/glossary";

export function Term({
  id,
  children,
  className,
}: {
  id: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const entry = glossaryEntry(id);
  const label = children ?? entry?.label ?? termLabel(id);
  if (!entry) {
    return <span className={className}>{label}</span>;
  }
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline cursor-help border-0 bg-transparent p-0 text-inherit underline decoration-dotted decoration-mute/70 underline-offset-2",
            className,
          )}
        >
          {label}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          className="z-[80] max-w-xs rounded-md border border-line bg-elev px-2.5 py-2 text-left text-xs leading-relaxed text-ink shadow-lg"
        >
          <div className="font-medium">{entry.label}</div>
          <p className="mt-1 text-mute">{entry.hint}</p>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function TermHead({ id, className }: { id: string; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap px-2 py-2 text-left font-medium", className)}>
      <Term id={id} />
    </th>
  );
}
