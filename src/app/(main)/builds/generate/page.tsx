import Link from "next/link";
import type { Metadata } from "next";

import type { GameRole } from "@/types/database";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { listActivePerkLabels } from "@/lib/services/perk-labels.service";
import { listCharacters, listPerks } from "@/lib/services/assets.service";
import { generateBuild } from "@/lib/services/generator.service";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Build Generator",
  description: "Generate a logical, role-scoped build from perk labels.",
};

type SP = { role?: string; labels?: string; owned?: string; seed?: string; locked?: string };

function parseLabels(sp: SP): string[] {
  return [
    ...new Set(
      (sp.labels ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

function hrefWith(opts: {
  role: GameRole;
  labels: string[];
  owned: boolean;
  locked?: string[];
  seed?: number;
}): string {
  const p = new URLSearchParams();
  p.set("role", opts.role);
  if (opts.labels.length) p.set("labels", opts.labels.join(","));
  if (opts.owned) p.set("owned", "1");
  if (opts.locked && opts.locked.length) p.set("locked", opts.locked.join(","));
  if (opts.seed) p.set("seed", String(opts.seed));
  const qs = p.toString();
  return qs ? `/builds/generate?${qs}` : "/builds/generate";
}

export default async function GenerateBuildPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const role: GameRole = searchParams.role === "survivor" ? "survivor" : "killer";
  const labels = parseLabels(searchParams);
  const ownedOnly = searchParams.owned === "1";
  const seed = Number(searchParams.seed) || 0;
  const lockedIds = [
    ...new Set(
      (searchParams.locked ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];

  const [activeLabels, profile] = await Promise.all([
    listActivePerkLabels(),
    getCurrentProfile(),
  ]);

  // Toggle a label slug on/off; reset seed when criteria change (keep locks).
  const labelToggle = (slug: string) =>
    hrefWith({
      role,
      owned: ownedOnly,
      locked: lockedIds,
      labels: labels.includes(slug)
        ? labels.filter((s) => s !== slug)
        : [...labels, slug],
    });

  const hasCriteria = labels.length > 0;
  const ownedNeedsLogin = ownedOnly && !profile;

  // Run the generator only when we have criteria and (if owned-only) a user.
  const result =
    hasCriteria && !ownedNeedsLogin
      ? await generateBuild({
          role,
          labelSlugs: labels,
          ownedOnly,
          userId: profile?.id ?? null,
          lockedPerkIds: lockedIds,
          seed,
        })
      : null;

  // Resolve origin character names for the result cards.
  let originByPerkId = new Map<string, string | null>();
  if (result?.ok) {
    const [rolePerks, characters] = await Promise.all([
      listPerks(role),
      listCharacters(),
    ]);
    const charName = new Map(characters.map((c) => [c.id, c.name]));
    const originId = new Map(rolePerks.map((p) => [p.id, p.origin_character_id]));
    originByPerkId = new Map(
      result.perks.map((p) => {
        const oid = originId.get(p.id) ?? null;
        return [p.id, oid ? charName.get(oid) ?? null : null];
      }),
    );
  }

  const nextSeed = Math.floor(Math.random() * 1_000_000) + 1;

  return (
    <div className="container max-w-4xl space-y-8 py-12">
      <header>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Build Generator
        </h1>
        <p className="mt-2 text-muted-foreground">
          Pick a role and the labels you want, and we&apos;ll assemble a logical,
          coherent loadout. This isn&apos;t a randomizer — perks are chosen to
          match your criteria.
        </p>
      </header>

      {/* Role */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Role
        </h2>
        <div className="flex gap-2">
          {(["killer", "survivor"] as GameRole[]).map((r) => (
            <Link
              key={r}
              href={hrefWith({ role: r, labels, owned: ownedOnly })}
              className={`rounded-md border px-4 py-1.5 text-sm capitalize transition-colors ${
                role === r
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              {r}
            </Link>
          ))}
        </div>
      </section>

      {/* Labels */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Criteria
        </h2>
        {activeLabels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active labels yet. An admin can add them in{" "}
            <Link href="/admin/perk-labels" className="text-link hover:text-link-hover hover:underline">
              Perk Labels
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeLabels.map((label) => {
              const active = labels.includes(label.slug);
              return (
                <Link
                  key={label.id}
                  href={labelToggle(label.slug)}
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
        )}
      </section>

      {/* Owned-only toggle + reroll */}
      <section className="flex flex-wrap items-center gap-3">
        <Link
          href={hrefWith({ role, labels, owned: !ownedOnly, locked: lockedIds })}
          aria-pressed={ownedOnly}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            ownedOnly
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:border-foreground/40"
          }`}
        >
          {ownedOnly ? "✓ Only my owned perks" : "Only use my owned perks"}
        </Link>
        {hasCriteria ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefWith({ role, labels, owned: ownedOnly, locked: lockedIds, seed: nextSeed })}>
              Reroll
            </Link>
          </Button>
        ) : null}
        {labels.length > 0 ? (
          <Link
            href={hrefWith({ role, labels: [], owned: ownedOnly })}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear criteria
          </Link>
        ) : null}
        <Link
          href="/account/perks"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Manage My Perks
        </Link>
      </section>

      {/* Results */}
      {ownedNeedsLogin ? (
        <p className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
          The owned-only option needs an account.{" "}
          <Link
            href="/login?next=/builds/generate"
            className="text-link hover:text-link-hover hover:underline"
          >
            Sign in
          </Link>{" "}
          and set up your collection in{" "}
          <Link href="/account/perks" className="text-link hover:text-link-hover hover:underline">
            My Perks
          </Link>
          .
        </p>
      ) : !hasCriteria ? (
        <p className="text-sm text-muted-foreground">
          Select at least one label above to generate a build.
        </p>
      ) : result && !result.ok ? (
        <div className="space-y-2 rounded-lg border border-border/60 p-4">
          <p className="text-sm">{result.error}</p>
          <p className="text-xs text-muted-foreground">
            Matched {result.matched} of {result.needed} needed.
          </p>
          {ownedOnly ? (
            <Link
              href="/account/perks"
              className="text-xs text-link hover:text-link-hover hover:underline"
            >
              Manage My Perks
            </Link>
          ) : null}
        </div>
      ) : result && result.ok ? (
        <section className="space-y-4">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm">{result.explanation}</p>
            {ownedOnly ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Restricted to perks you own.
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {result.perks.map((perk) => (
              <div
                key={perk.id}
                className="flex gap-3 rounded-lg border border-border/60 p-3"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-border/60">
                  <AssetThumb
                    src={perk.iconUrl}
                    alt={perk.name}
                    fallbackLabel={initialsFrom(perk.name)}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/perks/${perk.slug}`}
                      className="truncate font-display font-semibold uppercase tracking-wide hover:text-link-hover"
                    >
                      {perk.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {perk.score} pts
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {originByPerkId.get(perk.id) ?? "Universal perk"}
                  </p>
                  {perk.matchedLabels.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {perk.matchedLabels.map((name) => (
                        <span
                          key={name}
                          className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] text-primary"
                        >
                          {name}
                        </span>
                      ))}
                      {perk.isMeta ? (
                        <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-500">
                          Meta
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">{perk.reason}</p>
                  <Link
                    href={hrefWith({
                      role,
                      labels,
                      owned: ownedOnly,
                      seed,
                      locked: perk.locked
                        ? lockedIds.filter((id) => id !== perk.id)
                        : [...lockedIds, perk.id],
                    })}
                    aria-pressed={perk.locked}
                    className={`mt-2 inline-block rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                      perk.locked
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    }`}
                  >
                    {perk.locked ? "🔒 Locked — keeps on reroll" : "Lock"}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Lock the perks you want to keep, then Reroll to regenerate the rest.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button asChild>
              <Link
                href={`/builds/new?role=${role}&perk_ids=${result.perks
                  .map((p) => p.id)
                  .join(",")}${labels.length ? `&labels=${labels.join(",")}` : ""}`}
              >
                Create build from this
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              You&apos;ll review and submit it on the next screen.
            </span>
          </div>
        </section>
      ) : null}
    </div>
  );
}
