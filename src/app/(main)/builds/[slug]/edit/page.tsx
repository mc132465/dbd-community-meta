import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import { getBuildDetailBySlug } from "@/lib/services/builds.service";
import { getOpenRevision } from "@/lib/services/build-revisions.service";
import {
  listAddOns,
  listCharacters,
  listItems,
  listPerks,
} from "@/lib/services/assets.service";
import { listActiveTags } from "@/lib/services/tags.service";
import { activeRecommendationsByKiller } from "@/lib/services/recommendations.service";
import { CommunityBuildForm } from "@/components/builds/community-build-form";

export const metadata: Metadata = { title: "Edit build" };

export default async function EditBuildPage({
  params,
}: {
  params: { slug: string };
}) {
  const me = await getCurrentProfile();
  if (!me) redirect(`/login?next=/builds/${params.slug}/edit`);

  const detail = await getBuildDetailBySlug(params.slug);
  if (!detail) notFound();

  const build = detail.build;
  const isOwner = build.author_id === me.id;
  if (!isOwner && !isModerator(me.role)) notFound();

  const isPublic = build.status === "approved" || build.status === "archived";
  const openRevision = isPublic ? await getOpenRevision(build.id) : null;

  const [characters, perks, addOns, items, tags] = await Promise.all([
    listCharacters(),
    listPerks(),
    listAddOns(),
    listItems(),
    listActiveTags(),
  ]);
  const recommendationsByCharacter = await activeRecommendationsByKiller();

  const initialPerkIds = [...detail.loadout.perks]
    .sort((a, b) => a.slot - b.slot)
    .map((p) => p.perk.id);
  const initialAddOnIds = [...detail.loadout.addOns]
    .sort((a, b) => a.slot - b.slot)
    .map((a) => a.addOn.id);

  return (
    <div className="container max-w-3xl py-12">
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
        Edit build
      </h1>
      <p className="mt-2 text-muted-foreground">
        {isPublic
          ? "Your changes are submitted as a revision. The current public version stays live until a moderator approves it."
          : "This build isn't public yet, so your changes are saved directly."}
      </p>
      {openRevision ? (
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          You already have a revision awaiting review. Submitting again replaces it.
        </p>
      ) : null}

      <div className="mt-8">
        <CommunityBuildForm
          characters={characters.map((c) => ({
            id: c.id,
            name: c.name,
            role: c.role,
          }))}
          perks={perks.map((p) => ({
            id: p.id,
            name: p.name,
            role: p.role ?? undefined,
            iconUrl: p.icon_url,
          }))}
          addOns={addOns.map((a) => ({ id: a.id, name: a.name }))}
          items={items.map((i) => ({ id: i.id, name: i.name }))}
          tags={tags.map((t) => ({
            id: t.id,
            name: t.name,
            category: t.category?.name ?? null,
          }))}
          editBuildId={build.id}
          initialTitle={build.title ?? ""}
          initialRole={build.role}
          initialCharacterId={build.character_id ?? ""}
          initialDifficulty={build.difficulty_suggestion ?? ""}
          initialPerkIds={initialPerkIds}
          initialAddOnIds={initialAddOnIds}
          initialItemId={detail.loadout.item?.id ?? ""}
          initialTagIds={detail.communityTags.map((t) => t.id)}
          recommendationsByCharacter={recommendationsByCharacter}
        />
      </div>
    </div>
  );
}
