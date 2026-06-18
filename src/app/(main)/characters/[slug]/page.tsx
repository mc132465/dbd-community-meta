import Link from "next/link";
import { RelatedDiscussions } from "@/components/discussions/related-discussions";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  getAddOnsByCharacter,
  getCharacterBySlug,
  getKillerPower,
  getPerksByOriginCharacter,
} from "@/lib/services/assets.service";
import { listApprovedBuildsByCharacter } from "@/lib/services/builds.service";
import { getActiveRecommendations } from "@/lib/services/recommendations.service";
import { engagementCountsByBuildIds } from "@/lib/services/engagement.service";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import { RarityBadge, RoleBadge } from "@/components/assets/asset-card";
import { BuildCard } from "@/components/builds/build-card";

type Params = { params: { slug: string } };

export async function generateMetadata({
  params,
}: Params): Promise<Metadata> {
  const character = await getCharacterBySlug(params.slug);
  if (!character) return { title: "Character not found" };
  return { title: character.name };
}

export default async function CharacterDetailPage({ params }: Params) {
  const character = await getCharacterBySlug(params.slug);
  if (!character) notFound();

  const [perks, addOns, relatedBuilds, killerPower, recommendations] =
    await Promise.all([
      getPerksByOriginCharacter(character.id),
      character.role === "killer"
        ? getAddOnsByCharacter(character.id)
        : Promise.resolve([]),
      listApprovedBuildsByCharacter(character.id),
      character.role === "killer"
        ? getKillerPower(character.id)
        : Promise.resolve(null),
      character.role === "killer"
        ? getActiveRecommendations(character.id)
        : Promise.resolve([]),
    ]);

  // Prefer the first-class power row's fields; fall back to the character's
  // denormalized power_name/power_desc. The power icon comes from the powers row.
  const powerName = killerPower?.name ?? character.power_name ?? null;
  const powerDesc = killerPower?.description ?? character.power_desc ?? null;
  const powerNoob = killerPower?.noob_explanation ?? null;
  const powerIcon = killerPower?.icon_url ?? null;

  const buildCounts = await engagementCountsByBuildIds(
    relatedBuilds.map((b) => b.id),
  );

  return (
    <div className="container max-w-4xl py-12">
      <Link
        href="/characters"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All characters
      </Link>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="h-40 w-40 shrink-0 overflow-hidden rounded-lg border border-border/60">
          <AssetThumb
            src={character.image_url}
            alt={character.name}
            fallbackLabel={initialsFrom(character.name)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
              {character.name}
            </h1>
            <RoleBadge role={character.role} />
          </div>
          {character.title ? (
            <p className="text-lg text-muted-foreground">{character.title}</p>
          ) : null}
          {character.chapter ? (
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              {character.chapter}
            </p>
          ) : null}
          {character.description ? (
            <p className="text-sm text-muted-foreground">
              {character.description}
            </p>
          ) : null}
          {character.home_realm ? (
            <p className="text-sm text-muted-foreground">
              Realm: {character.home_realm}
            </p>
          ) : null}
        </div>
      </div>

      {character.role === "killer" && powerName ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Power
          </h2>
          <div className="mt-2 flex items-start gap-4">
            {powerIcon ? (
              <AssetThumb
                src={powerIcon}
                alt={powerName}
                fallbackLabel={initialsFrom(powerName)}
                className="h-16 w-16 shrink-0"
              />
            ) : null}
            <div className="flex-1">
              <h3 className="font-display text-xl font-semibold">{powerName}</h3>
              {powerDesc ? (
                <>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Official Description
                  </p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">
                    {powerDesc}
                  </p>
                </>
              ) : null}
              {powerNoob ? (
                <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="font-display text-sm font-bold uppercase tracking-wide text-primary">
                    For Noobs:
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm">{powerNoob}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {character.role === "killer" && recommendations.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Recommended perks
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Curated picks that pair well with {character.name}&apos;s power.
            Optional — use them in your own builds.
          </p>
          <ul className="mt-3 space-y-2">
            {recommendations.map((rec) => (
              <li key={rec.id}>
                <Link
                  href={`/perks/${rec.perkSlug}`}
                  className="flex items-start gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:border-border"
                >
                  <AssetThumb
                    src={rec.perkIcon}
                    alt={rec.perkName}
                    fallbackLabel={initialsFrom(rec.perkName)}
                    className="h-9 w-9 rounded"
                  />
                  <div className="min-w-0">
                    <span className="font-display font-semibold uppercase tracking-wide">
                      {rec.perkName}
                    </span>
                    {rec.note ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {rec.note}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {character.lore ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Lore
          </h2>
          <p className="mt-2 text-muted-foreground">{character.lore}</p>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Unique perks ({perks.length})
        </h2>
        {perks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No unique perks recorded yet.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {perks.map((perk) => (
              <li key={perk.id}>
                <Link
                  href={`/perks/${perk.slug}`}
                  className="block rounded-lg border border-border/60 p-3 transition-colors hover:border-border"
                >
                  <span className="font-display font-semibold uppercase tracking-wide">
                    {perk.name}
                  </span>
                  {perk.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {perk.description}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {character.role === "killer" ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Add-ons ({addOns.length})
          </h2>
          {addOns.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No add-ons recorded.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {addOns.map((addOn) => (
                <li
                  key={addOn.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 p-3"
                >
                  <span className="font-medium">{addOn.name}</span>
                  <RarityBadge rarity={addOn.rarity} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Related builds ({relatedBuilds.length})
        </h2>
        {relatedBuilds.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No published builds for {character.name} yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {relatedBuilds.map((build) => (
              <BuildCard
                key={build.id}
                build={build}
                likeCount={buildCounts.get(build.id)?.likes}
                commentCount={buildCounts.get(build.id)?.comments}
              />
            ))}
          </div>
        )}
      </section>

      <RelatedDiscussions characterId={character.id} />
    </div>
  );
}
