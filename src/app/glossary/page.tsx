import { glossaryGroups, GLOSSARY } from "@/lib/glossary";

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Terms in plain English</h2>
        <p className="mt-1 max-w-3xl text-sm text-mute">
          Every dotted word in the app opens a one-line meaning. This page is the full list. Nothing here is a buy or sell
          call. Numbers come from official stored prices and NAVs.
        </p>
      </div>
      {glossaryGroups().map((group) => (
        <section key={group.heading} className="rounded border border-line bg-elev">
          <h3 className="border-b border-line px-3 py-2 text-sm font-medium">{group.heading}</h3>
          <dl className="divide-y divide-line">
            {group.ids.map((id) => {
              const e = GLOSSARY[id];
              if (!e) return null;
              return (
                <div key={id} className="grid gap-1 px-3 py-2 sm:grid-cols-[12rem_1fr]">
                  <dt className="text-sm font-medium">{e.label}</dt>
                  <dd className="text-sm text-mute">{e.hint}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
