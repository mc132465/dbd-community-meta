import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentProfile } from "@/lib/services/profile.service";
import {
  listAddOns,
  listCharacters,
  listItems,
  listPerks,
} from "@/lib/services/assets.service";
import { listActiveTags } from "@/lib/services/tags.service";
import { listOwnedPerkIds } from "@/lib/services/owned-perks.service";
import { activeRecommendationsByKiller } from "@/lib/services/recommendations.service";
import { CommunityBuildForm } from "@/components/builds/community-build-form";

export const metadata: Metadata = { title: "Submit a build" };

export default async function NewBuildPage({
  searchParams,
}: {
  searchParams: { role?: string; perk_ids?: string; labels?: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/builds/new");

  const [characters, perks, addOns, items, tags] = await Promise.all([
    listCharacters(),
    listPerks(),
    listAddOns(),
    listItems(),
    listActiveTags(),
  ]);
  const ownedPerkIds = await listOwnedPerkIds(profile.id);
  const recommendationsByCharacter = await activeRecommendationsByKiller();

  // ----- Generator handoff (never trust query params blindly) -----
  const initialRole =
    searchParams.role === "survivor"
      ? "survivor"
      : searchParams.role === "killer"
        ? "killer"
        : undefined;
  const effectiveRole = initialRole ?? "killer";

  const perkById = new Map(perks.map((p) => [p.id, p]));
  const rawPerkIds = (searchParams.perk_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Keep only real perks that match the selected role; drop unknown/mismatched.
  const initialPerkIds = [...new Set(rawPerkIds)]
    .filter((id) => {
      const p = perkById.get(id);
      return p && (p.role ?? null) === effectiveRole;
    })
    .slice(0, 4);

  // Suggested build tags: label slug -> existing build tag with the same slug.
  const labelSlugs = (searchParams.labels ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const initialTagIds = labelSlugs.length
    ? tags.filter((t) => labelSlugs.includes(t.slug)).map((t) => t.id)
    : [];

  return (
    <div className="container max-w-3xl py-12">
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
        Submit a build
      </h1>
      <p className="mt-2 text-muted-foreground">
        Share a loadout. Community submissions are reviewed before going public.
      </p>

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
          initialRole={initialRole}
          initialPerkIds={initialPerkIds}
          initialTagIds={initialTagIds}
          ownedPerkIds={ownedPerkIds}
          recommendationsByCharacter={recommendationsByCharacter}
        />
      </div>
    </div>
  );
}
