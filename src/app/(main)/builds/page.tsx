import Link from "next/link";
import type { Metadata } from "next";

import {
  searchApprovedBuilds,
  type BuildBrowseOptions,
  type BuildCard as BuildCardType,
} from "@/lib/services/builds.service";
import {
  listPopularBuilds,
  listTrendingBuilds,
} from "@/lib/services/build-discovery.service";
import { listActiveTags } from "@/lib/services/tags.service";
import { listCharacters } from "@/lib/services/assets.service";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { engagementCountsByBuildIds } from "@/lib/services/engagement.service";
import { Button } from "@/components/ui/button";
import { BuildCard } from "@/components/builds/build-card";
import { BuildsFilter } from "@/components/builds/builds-filter";

export const metadata: Metadata = {
  title: "Builds",
  description: "Community and official Dead by Daylight builds.",
};

type SP = {
  q?: string;
  role?: string;
  character?: string;
  tag?: string;
  tags?: string;
};

function parseTags(sp: SP): string[] {
  const raw = [sp.tags, sp.tag].filter(Boolean).join(",");
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

export default async function BuildsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const role =
    searchParams.role === "killer" || searchParams.role === "survivor"
      ? searchParams.role
      : undefined;
  const character = (searchParams.character ?? "").trim() || undefined;
  const q = (searchParams.q ?? "").trim() || undefined;
  const selectedTags = parseTags(searchParams);

  const opts: BuildBrowseOptions = { q, role, character, tags: selectedTags };
  const hasFilters =
    !!q || !!role || !!character || selectedTags.length > 0;

  const [builds, tags, characters, profile, popular, trending] =
    await Promise.all([
      searchApprovedBuilds(opts),
      listActiveTags(),
      listCharacters(),
      getCurrentProfile(),
      hasFilters
        ? Promise.resolve([] as BuildCardType[])
        : listPopularBuilds(6),
      hasFilters
        ? Promise.resolve([] as BuildCardType[])
        : listTrendingBuilds(6),
    ]);

  const counts = await engagementCountsByBuildIds([
    ...builds.map((b) => b.id),
    ...popular.map((b) => b.id),
    ...trending.map((b) => b.id),
  ]);
  const showDiscovery =
    !hasFilters && (popular.length > 0 || trending.length > 0);

  return (
    <div className="container space-y-8 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            Builds
          </h1>
          <p className="mt-2 text-muted-foreground">
            Community loadouts and staff-curated official builds.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/builds/generate">Generate a build</Link>
          </Button>
          {profile ? (
            <Button asChild>
              <Link href="/builds/new">Submit a build</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/login?next=/builds/new">Sign in to submit</Link>
            </Button>
          )}
        </div>
      </header>

      <BuildsFilter
        characters={characters.map((c) => ({
          slug: c.slug,
          name: c.name,
          role: c.role,
        }))}
        tags={tags.map((t) => ({ slug: t.slug, name: t.name }))}
        current={{
          q: q ?? "",
          role: role ?? "",
          character: character ?? "",
          tags: selectedTags,
        }}
      />

      {showDiscovery ? (
        <div className="space-y-8">
          {trending.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold uppercase tracking-tight">
                Trending this week
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trending.map((build) => (
                  <BuildCard
                    key={`trending-${build.id}`}
                    build={build}
                    likeCount={counts.get(build.id)?.likes}
                    commentCount={counts.get(build.id)?.comments}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {popular.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold uppercase tracking-tight">
                Popular builds
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {popular.map((build) => (
                  <BuildCard
                    key={`popular-${build.id}`}
                    build={build}
                    likeCount={counts.get(build.id)?.likes}
                    commentCount={counts.get(build.id)?.comments}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {showDiscovery ? (
        <h2 className="font-display text-xl font-semibold uppercase tracking-tight">
          All builds
        </h2>
      ) : null}

      {builds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? "No builds match these filters. Try widening your search or clearing filters."
            : "No published builds yet. Be the first to submit one."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {builds.map((build) => (
            <BuildCard
              key={build.id}
              build={build}
              likeCount={counts.get(build.id)?.likes}
              commentCount={counts.get(build.id)?.comments}
            />
          ))}
        </div>
      )}
    </div>
  );
}
