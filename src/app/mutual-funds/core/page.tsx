"use client";

import { useQuery } from "@tanstack/react-query";
import { MfTable } from "@/components/mf-table";
import type { MfRow } from "@/services/mf-queries";

export default function Page() {
  const q = useQuery({
    queryKey: ["mf-core"],
    queryFn: () => fetch("/api/mutual-funds/core").then((r) => r.json()),
  });
  const buckets = q.data?.buckets ?? {};
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Core Portfolio research buckets</h2>
        <p className="text-sm text-mute">{q.data?.disclaimer}</p>
      </div>
      {Object.entries(buckets).map(([name, rows]) => (
        <section key={name}>
          <h3 className="mb-2 text-sm uppercase tracking-wide text-mute">{name.replace(/([A-Z])/g, " $1")}</h3>
          <MfTable rows={(rows as MfRow[]) ?? []} />
        </section>
      ))}
    </div>
  );
}
