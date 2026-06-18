import Link from "next/link";
import type { Metadata } from "next";

import { listPerks } from "@/lib/services/assets.service";
import {
  getActiveLabelsBySlugs,
  listActivePerkLabels,
  perkIdsWithAllLabels,
} from "@/lib/services/perk-labels.service";
import { RoleBadge } from "@/components/assets/asset-card";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";

export const metadata: Metadata = {
  title: "Perks",
  description: "Killer and survivor perks.",
};

type PerkList = Awaited<ReturnType<typeof listPerks>>;

/** Parse ?labels=a,b,c into a unique, ordered slug list. */
function parseSelected(searchParams: { labels?: string }): string[] {
  return [
    ...new Set(
      (searchParams.labels ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** /perks href with `slug` toggled in/out of the current selection. */
function toggleHref(selected: string[], slug: string): string {
  const next = selected.includes(slug)
    ? selected.filter((s) => s !== slug)
    : [...selected, slug];
  return next.length > 0 ? `/perks?labels=${next.join(",")}` : "/perks";
}

export default async function PerksPage({
  searchParams,
}: {
  searchParams: { labels?: string; q?: string };
}) {
  const selected = parseSelected(searchParams);
  const q = (searchParams.q ?? "").trim();
  const [perks, labels] = await Promise.all([
    listPerks(),
    listActivePerkLabels(),
  ]);

  // Apply AND label filtering when labels are selected.
  let filtered: PerkList = perks;
  let invalidSelection = false;
  if (selected.length > 0) {
    const resolved = await getActiveLabelsBySlugs(selected);
    if (resolved.length !== selected.length) {
      // An unknown/disabled label slug can't be satisfied → no matches.
      invalidSelection = true;
      filtered = [];
    } else {
      const allowed = new Set(
        await perkIdsWithAllLabels(resolved.map((l) => l.id)),
      );
      filtered = perks.filter((p) => allowed.has(p.id));
    }
  }

  // Free-text filter on name/description (case-insensitive), with prefix
  // matches ranked above substring matches.
  if (q.length > 0) {
    const needle = q.toLowerCase();
    filtered = filtered.filter((p) =>
      `${p.name} ${p.description ?? ""}`.toLowerCase().includes(needle),
    );
    filtered = [...filtered].sort((a, b) => {
      const ra = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
      const rb = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
      return ra - rb || a.name.localeCompare(b.name);
    });
  }

  const killer = filtered.filter((p) => p.role === "killer");
  const survivor = filtered.filter((p) => p.role === "survivor");
  const unspecified = filtered.filter((p) => !p.role);
  const hasFilters = selected.length > 0 || q.length > 0;

  return (
    <div className="container space-y-8 py-12">
      <header>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Perks
        </h1>
        <p className="mt-2 text-muted-foreground">Killer and survivor perks.</p>
        <form method="get" role="search" className="mt-4 max-w-sm">
          {selected.length > 0 ? (
            <input type="hidden" name="labels" value={selected.join(",")} />
          ) : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search perks by name or text…"
            aria-label="Search perks"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
          />
        </form>
      </header>

      {/* Label filters (AND semantics) from active labels. */}
      {labels.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => {
              const active = selected.includes(label.slug);
              return (
                <Link
                  key={label.id}
                  href={toggleHref(selected, label.slug)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40"
                  }`}
                >
                  {label.name}
                </Link>
              );
            })}
          </div>
          {hasFilters ? (
            <p className="text-xs text-muted-foreground">
              Showing perks labelled{" "}
              <span className="text-foreground">{selected.join(" + ")}</span>{" "}
              (all selected).{" "}
              <Link href="/perks" className="text-link hover:text-link-hover hover:underline">
                Clear filters
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {hasFilters && filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {invalidSelection
            ? "No perks match the selected labels."
            : q.length > 0
              ? `No perks match “${q}”${selected.length > 0 ? " with the selected labels" : ""}.`
              : "No perks have all of the selected labels."}
        </p>
      ) : (
        <div className="space-y-10">
          <PerkGroup title="Killer perks" perks={killer} />
          <PerkGroup title="Survivor perks" perks={survivor} />
          {unspecified.length > 0 ? (
            <PerkGroup title="Unspecified role" perks={unspecified} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function PerkGroup({ title, perks }: { title: string; perks: PerkList }) {
  if (perks.length === 0) return null;
  return (
    <section>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title} ({perks.length})
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {perks.map((perk) => (
          <li key={perk.id}>
            <Link
              href={`/perks/${perk.slug}`}
              className="flex h-full flex-col gap-1 rounded-lg border border-border/60 p-4 transition-colors hover:border-border"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-border/60">
                  <AssetThumb
                    src={perk.icon_url}
                    alt={perk.name}
                    fallbackLabel={initialsFrom(perk.name)}
                  />
                </div>
                <span className="min-w-0 flex-1 truncate font-display font-semibold uppercase tracking-wide">
                  {perk.name}
                </span>
                <RoleBadge role={perk.role} />
              </div>
              {perk.description ? (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {perk.description}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
