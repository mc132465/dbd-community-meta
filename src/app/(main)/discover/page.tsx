import Link from "next/link";
import type { Metadata } from "next";

import { discover } from "@/lib/services/discovery.service";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import { RoleBadge } from "@/components/assets/asset-card";
import { OfficialBadge } from "@/components/builds/badges";
import { BuildCard } from "@/components/builds/build-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Discover",
  description: "Search characters, perks, builds, and tier lists.",
};

type Params = { searchParams: { q?: string } };

export default async function DiscoverPage({ searchParams }: Params) {
  const q = (searchParams.q ?? "").trim();
  const result = q
    ? await discover(q)
    : { query: "", characters: [], perks: [], builds: [], tierLists: [] };

  const hasAny =
    result.characters.length > 0 ||
    result.perks.length > 0 ||
    result.builds.length > 0 ||
    result.tierLists.length > 0;

  return (
    <div className="container max-w-5xl space-y-8 py-12">
      <header className="space-y-4">
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Discover
        </h1>
        <form action="/discover" method="get" className="flex gap-2">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search a character, perk, build, or tier list…"
            autoComplete="off"
            aria-label="Search"
            className="max-w-xl"
          />
          <Button type="submit">Search</Button>
        </form>
      </header>

      {!q ? (
        <p className="text-sm text-muted-foreground">
          Try a name like “Nurse”, “Pain Resonance”, or “Blight” — you don’t need
          to know whether it’s a character, perk, build, or tier list.
        </p>
      ) : !hasAny ? (
        <p className="text-sm text-muted-foreground">
          Nothing found for “{q}”. Try a different spelling or a shorter term.
        </p>
      ) : (
        <div className="space-y-12">
          {result.characters.length > 0 ? (
            <Group title="Characters" count={result.characters.length}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.characters.map((c) => (
                  <Link
                    key={c.id}
                    href={`/characters/${c.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:border-border"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border/60">
                      <AssetThumb
                        src={c.imageUrl}
                        alt={c.name}
                        fallbackLabel={initialsFrom(c.name)}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold uppercase tracking-wide">
                          {c.name}
                        </span>
                        <RoleBadge role={c.role} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.perkCount} {c.perkCount === 1 ? "perk" : "perks"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </Group>
          ) : null}

          {result.perks.length > 0 ? (
            <Group title="Perks" count={result.perks.length}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.perks.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-border/60 p-3 transition-colors hover:border-border"
                  >
                    <Link
                      href={`/perks/${p.slug}`}
                      className="flex items-center gap-3"
                    >
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-border/60">
                        <AssetThumb
                          src={p.iconUrl}
                          alt={p.name}
                          fallbackLabel={initialsFrom(p.name)}
                        />
                      </div>
                      <span className="font-display font-semibold uppercase tracking-wide">
                        {p.name}
                      </span>
                    </Link>
                    {p.origin ? (
                      <Link
                        href={`/characters/${p.origin.slug}`}
                        className="mt-2 block text-xs text-muted-foreground hover:text-foreground"
                      >
                        {p.origin.name}
                      </Link>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Universal perk
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Group>
          ) : null}

          {result.builds.length > 0 ? (
            <Group title="Builds" count={result.builds.length}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {result.builds.map((b) => (
                  <BuildCard key={b.id} build={b} />
                ))}
              </div>
            </Group>
          ) : null}

          {result.tierLists.length > 0 ? (
            <Group title="Tier Lists" count={result.tierLists.length}>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.tierLists.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tier-lists/${t.slug}`}
                    className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 transition-colors hover:border-border"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-semibold uppercase tracking-wide">
                        {t.title}
                      </span>
                      {t.isOfficial ? (
                        <OfficialBadge />
                      ) : (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Community
                        </span>
                      )}
                    </div>
                    {t.topPerks.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {t.topPerks.map((p) => (
                          <div
                            key={p.id}
                            className="h-9 w-9 overflow-hidden rounded-md border border-border/60"
                            title={p.name}
                          >
                            <AssetThumb
                              src={p.iconUrl}
                              alt={p.name}
                              fallbackLabel={initialsFrom(p.name)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Link>
                ))}
              </div>
            </Group>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title} ({count})
      </h2>
      {children}
    </section>
  );
}
