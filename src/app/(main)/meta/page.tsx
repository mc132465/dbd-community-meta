import Link from "next/link";
import type { Metadata } from "next";

import {
  topAddOns,
  topCharacters,
  topItems,
  topPerks,
  type MetaEntry,
} from "@/lib/services/meta.service";

export const metadata: Metadata = {
  title: "Meta",
  description: "Most-used perks, killers, survivors, items, and add-ons.",
};

function MetaList({
  title,
  entries,
  hrefBase,
}: {
  title: string;
  entries: MetaEntry[];
  hrefBase?: string;
}) {
  return (
    <section className="rounded-lg border border-border/60 bg-card p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <ol className="space-y-1.5 text-sm">
          {entries.map((e, i) => (
            <li key={e.slug} className="flex items-center gap-2">
              <span className="w-5 text-right tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              {hrefBase ? (
                <Link
                  href={`${hrefBase}/${e.slug}`}
                  className="flex-1 truncate hover:underline"
                >
                  {e.name}
                </Link>
              ) : (
                <span className="flex-1 truncate">{e.name}</span>
              )}
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {e.count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function MetaPage() {
  const [perks, killers, survivors, items, addOns] = await Promise.all([
    topPerks(15),
    topCharacters("killer", 10),
    topCharacters("survivor", 10),
    topItems(10),
    topAddOns(10),
  ]);

  const totalDataPoints =
    perks.length + killers.length + survivors.length + items.length + addOns.length;

  return (
    <div className="container space-y-8 py-12">
      <header>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Meta
        </h1>
        <p className="mt-2 text-muted-foreground">
          The most-used perks, killers, survivors, items, and add-ons across
          approved community builds.
        </p>
      </header>

      {totalDataPoints === 0 ? (
        <p className="text-sm text-muted-foreground">
          No approved builds yet — once the community starts sharing builds, the
          meta will appear here.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MetaList title="Top perks" entries={perks} hrefBase="/perks" />
          <MetaList title="Top killers" entries={killers} hrefBase="/characters" />
          <MetaList
            title="Top survivors"
            entries={survivors}
            hrefBase="/characters"
          />
          <MetaList title="Top items" entries={items} hrefBase="/items" />
          <MetaList title="Top add-ons" entries={addOns} hrefBase="/add-ons" />
        </div>
      )}
    </div>
  );
}
