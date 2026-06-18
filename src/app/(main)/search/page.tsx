import Link from "next/link";
import type { Metadata } from "next";

import { globalSearch } from "@/lib/services/search.service";
import { SearchBar } from "@/components/search/search-bar";
import { BuildCard } from "@/components/builds/build-card";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title} <span className="text-foreground/60">({count})</span>
      </h2>
      {children}
    </section>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const res = await globalSearch(q);
  const tooShort = q.length < 2;

  return (
    <div className="container max-w-5xl space-y-8 py-12">
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
          Search
        </h1>
        <SearchBar defaultValue={q} className="w-full max-w-xl" autoFocus />
        {!tooShort ? (
          <p className="text-sm text-muted-foreground">
            {res.total > 0
              ? `${res.total} result${res.total === 1 ? "" : "s"} for “${q}”.`
              : `No results for “${q}”.`}
          </p>
        ) : null}
      </div>

      {tooShort ? (
        <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          Type at least 2 characters to search builds, perks, killers,
          survivors, tier lists, and discussions.
        </p>
      ) : res.total === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing matched “{q}”. Try a different spelling or a shorter term.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <Section title="Builds" count={res.builds.length}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {res.builds.map((b) => (
                <BuildCard key={b.id} build={b} />
              ))}
            </div>
          </Section>

          <Section title="Killers" count={res.killers.length}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {res.killers.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/characters/${c.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-border/60 p-2 transition-colors hover:border-border"
                  >
                    <AssetThumb
                      src={c.imageUrl}
                      alt={c.name}
                      fallbackLabel={initialsFrom(c.name)}
                      className="h-9 w-9"
                    />
                    <span className="text-sm font-medium">{c.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Survivors" count={res.survivors.length}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {res.survivors.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/characters/${c.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-border/60 p-2 transition-colors hover:border-border"
                  >
                    <AssetThumb
                      src={c.imageUrl}
                      alt={c.name}
                      fallbackLabel={initialsFrom(c.name)}
                      className="h-9 w-9"
                    />
                    <span className="text-sm font-medium">{c.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Perks" count={res.perks.length}>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {res.perks.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/perks/${p.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-border/60 p-2 transition-colors hover:border-border"
                  >
                    <AssetThumb
                      src={p.iconUrl}
                      alt={p.name}
                      fallbackLabel={initialsFrom(p.name)}
                      className="h-9 w-9"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {p.name}
                      </span>
                      {p.origin ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.origin.name}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Tier lists" count={res.tierLists.length}>
            <ul className="space-y-2">
              {res.tierLists.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tier-lists/${t.slug}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-2 transition-colors hover:border-border"
                  >
                    <span className="text-sm font-medium">{t.title}</span>
                    {t.isOfficial ? (
                      <span className="shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] uppercase text-primary">
                        Official
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Discussions" count={res.discussions.length}>
            <ul className="space-y-2">
              {res.discussions.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/discussions/${d.slug}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-2 transition-colors hover:border-border"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">
                      {d.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {d.replyCount}{" "}
                      {d.replyCount === 1 ? "reply" : "replies"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </div>
  );
}
