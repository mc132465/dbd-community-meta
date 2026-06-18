import Link from "next/link";
import { RelatedDiscussions } from "@/components/discussions/related-discussions";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  getCharacterRefById,
  getPerkBySlug,
} from "@/lib/services/assets.service";
import { tierListsContainingPerk } from "@/lib/services/tierlists.service";
import { labelsForPerk } from "@/lib/services/perk-labels.service";
import { relatedPerks } from "@/lib/services/meta.service";
import { RoleBadge } from "@/components/assets/asset-card";

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const perk = await getPerkBySlug(params.slug);
  if (!perk) return { title: "Perk not found" };
  return { title: perk.name };
}

export default async function PerkDetailPage({ params }: Params) {
  const perk = await getPerkBySlug(params.slug);
  if (!perk) notFound();

  // Resolve the origin character (if any) for a link.
  let origin: { name: string; slug: string } | null = null;
  if (perk.origin_character_id) {
    origin = await getCharacterRefById(perk.origin_character_id);
  }

  // Published tier lists that rank this perk (works for universal perks too).
  const tierPlacements = await tierListsContainingPerk(perk.id);

  // Active labels assigned to this perk.
  const labels = await labelsForPerk(perk.id);

  // Perks most often paired with this one in approved community builds.
  const related = await relatedPerks(perk.id, 6);

  return (
    <div className="container max-w-2xl py-12">
      <Link
        href="/perks"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All perks
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          {perk.name}
        </h1>
        <RoleBadge role={perk.role} />
      </div>

      {perk.description ? (
        <section className="mt-6">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Official Description
          </h2>
          <p className="mt-2 whitespace-pre-line">{perk.description}</p>
        </section>
      ) : null}

      {perk.noob_explanation ? (
        <section className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h2 className="font-display text-base font-bold uppercase tracking-wide text-primary">
            For Noobs:
          </h2>
          <p className="mt-2 whitespace-pre-line">{perk.noob_explanation}</p>
        </section>
      ) : null}

      <dl className="mt-8 grid grid-cols-[140px_1fr] gap-y-3 text-sm">
        <dt className="text-muted-foreground">Teachable</dt>
        <dd>{perk.is_teachable ? "Yes" : "No"}</dd>
        <dt className="text-muted-foreground">Origin</dt>
        <dd>
          {origin ? (
            <Link
              href={`/characters/${origin.slug}`}
              className="text-link hover:text-link-hover hover:underline"
            >
              {origin.name}
            </Link>
          ) : (
            "General perk"
          )}
        </dd>
      </dl>

      {labels.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Labels
          </h2>
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <Link
                key={label.id}
                href={`/perks?labels=${label.slug}`}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                {label.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Tier Lists
        </h2>
        {tierPlacements.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground/70">
            Not ranked in any published tier list yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tierPlacements.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/tier-lists/${p.slug}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 transition-colors hover:border-border"
                >
                  <span className="font-display text-sm font-semibold uppercase tracking-wide">
                    {p.title}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {p.tier} Tier
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Frequently paired with
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/perks/${r.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-sm transition-colors hover:border-border"
                >
                  <span>{r.name}</span>
                  <span className="text-xs text-muted-foreground">×{r.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <RelatedDiscussions perkId={perk.id} />
    </div>
  );
}
