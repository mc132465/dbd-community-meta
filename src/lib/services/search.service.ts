import "server-only";

import {
  discover,
  rankScore,
  type DiscoveryCharacter,
  type DiscoveryPerk,
  type DiscoveryTierList,
} from "@/lib/services/discovery.service";
import {
  listThreads,
  type ThreadListItem,
} from "@/lib/services/discussions.service";
import type { BuildCard } from "@/lib/services/builds.service";

export type GlobalSearchResult = {
  query: string;
  builds: BuildCard[];
  killers: DiscoveryCharacter[];
  survivors: DiscoveryCharacter[];
  perks: DiscoveryPerk[];
  tierLists: DiscoveryTierList[];
  discussions: ThreadListItem[];
  total: number;
};

/**
 * Platform-wide search. Composes the existing discovery search (characters,
 * perks, builds, tier lists — partial/ILIKE matches) with the discussions
 * thread search. No new query logic: it reuses discover() and listThreads().
 * Characters are split into killers/survivors by role. ("Guides" are not a
 * modeled entity yet, so they are intentionally omitted.)
 */
export async function globalSearch(
  rawQuery: string,
): Promise<GlobalSearchResult> {
  const query = rawQuery.trim();
  const empty: GlobalSearchResult = {
    query,
    builds: [],
    killers: [],
    survivors: [],
    perks: [],
    tierLists: [],
    discussions: [],
    total: 0,
  };
  if (query.length < 2) return empty;

  const [disc, threads] = await Promise.all([
    discover(query),
    listThreads({ search: query, pageSize: 10 }),
  ]);

  const killers = disc.characters.filter((c) => c.role === "killer");
  const survivors = disc.characters.filter((c) => c.role === "survivor");
  const discussions = threads.items;

  const total =
    disc.builds.length +
    killers.length +
    survivors.length +
    disc.perks.length +
    disc.tierLists.length +
    discussions.length;

  return {
    query,
    builds: disc.builds,
    killers,
    survivors,
    perks: disc.perks,
    tierLists: disc.tierLists,
    discussions,
    total,
  };
}

export type SearchSuggestion = { label: string; sublabel: string; href: string };

/**
 * Lightweight typeahead suggestions for the navbar search. Reuses discover() and
 * returns a small, mixed, ranked list (characters, perks, builds). No new query
 * logic. Enter still performs the full /search.
 */
export async function searchSuggestions(
  rawQuery: string,
): Promise<SearchSuggestion[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];
  const disc = await discover(query);

  // Rank every candidate across all types by match quality (prefix strongly
  // outranks substring), with shorter/alphabetical names breaking ties. This
  // ranks globally rather than per-category, so a prefix-matching perk beats a
  // substring-matching character.
  const scored: (SearchSuggestion & { rank: number })[] = [];
  for (const c of disc.characters) {
    scored.push({
      label: c.name,
      sublabel: c.role === "killer" ? "Killer" : "Survivor",
      href: `/characters/${c.slug}`,
      rank: rankScore(query, c.name, c.slug),
    });
  }
  for (const p of disc.perks) {
    scored.push({
      label: p.name,
      sublabel: "Perk",
      href: `/perks/${p.slug}`,
      rank: rankScore(query, p.name, p.slug),
    });
  }
  for (const b of disc.builds) {
    scored.push({
      label: b.title,
      sublabel: "Build",
      href: `/builds/${b.slug}`,
      rank: rankScore(query, b.title, b.slug),
    });
  }

  scored.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.label.length - b.label.length ||
      a.label.localeCompare(b.label),
  );

  return scored.slice(0, 8).map(({ label, sublabel, href }) => ({
    label,
    sublabel,
    href,
  }));
}
