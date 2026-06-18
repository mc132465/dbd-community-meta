import Link from "next/link";
import type { Metadata } from "next";

import {
  communityMeta,
  type CommunityMetaCategory,
  type CommunityMetaEntry,
} from "@/lib/services/tierlists.service";

export const metadata: Metadata = {
  title: "Community Meta",
  description:
    "The Fog Archives community's living meta snapshot — aggregated from user tier lists, ratings, and placements.",
};

const TIER_COLOR: Record<string, string> = {
  S: "bg-rose-500/20 text-rose-300",
  A: "bg-orange-500/20 text-orange-300",
  B: "bg-amber-500/20 text-amber-300",
  C: "bg-lime-500/20 text-lime-300",
  D: "bg-sky-500/20 text-sky-300",
  F: "bg-zinc-500/20 text-zinc-300",
};

function MetaColumn({
  title,
  entries,
  hrefBase,
}: {
  title: string;
  entries: CommunityMetaEntry[];
  hrefBase?: string;
}) {
  return (
    <section className="rounded-lg border border-border/60 bg-card p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Not enough community tier lists yet.
        </p>
      ) : (
        <ol className="space-y-1.5 text-sm">
          {entries.map((e, i) => (
            <li key={e.slug} className="flex items-center gap-2">
              <span className="w-5 text-right tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${
                  TIER_COLOR[e.tier] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {e.tier}
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
              <span className="shrink-0 text-xs text-muted-foreground">
                {e.count} {e.count === 1 ? "list" : "lists"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function CommunityMetaPage() {
  const cats: { key: CommunityMetaCategory; title: string; hrefBase?: string }[] =
    [
      { key: "killers", title: "Killers", hrefBase: "/characters" },
      { key: "survivors", title: "Survivors", hrefBase: "/characters" },
      { key: "killer_perks", title: "Killer perks", hrefBase: "/perks" },
      { key: "survivor_perks", title: "Survivor perks", hrefBase: "/perks" },
      { key: "maps", title: "Maps", hrefBase: "/maps" },
    ];
  const results = await Promise.all(cats.map((c) => communityMeta(c.key, 15)));
  const total = results.reduce((n, r) => n + r.length, 0);

  return (
    <div className="container space-y-8 py-12">
      <header>
        <Link
          href="/tier-lists"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All tier lists
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight">
          Community Meta
        </h1>
        <p className="mt-2 text-muted-foreground">
          The community&apos;s living meta snapshot — where killers, survivors,
          perks, and maps land across every published Fog Archives tier list.
        </p>
      </header>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          The community meta is still forming. Once people publish tier lists,
          the snapshot appears here.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cats.map((c, i) => (
            <MetaColumn
              key={c.key}
              title={c.title}
              entries={results[i]}
              hrefBase={c.hrefBase}
            />
          ))}
        </div>
      )}
    </div>
  );
}
