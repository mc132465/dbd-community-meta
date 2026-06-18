import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { listCharacters, listPerks } from "@/lib/services/assets.service";
import { listOwnedPerkIds } from "@/lib/services/owned-perks.service";
import {
  labelsByPerkIds,
  listActivePerkLabels,
} from "@/lib/services/perk-labels.service";
import { MyPerksManager } from "@/components/account/my-perks-manager";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "My Perks",
  description: "Mark which perks you own.",
};

export default async function MyPerksPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/account/perks");

  const [perks, characters, ownedIds, labels] = await Promise.all([
    listPerks(),
    listCharacters(),
    listOwnedPerkIds(profile.id),
    listActivePerkLabels(),
  ]);
  const labelMap = await labelsByPerkIds(perks.map((p) => p.id));
  const charNameById = new Map(characters.map((c) => [c.id, c.name]));

  const items = perks.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    role: p.role,
    iconUrl: p.icon_url,
    origin: p.origin_character_id
      ? charNameById.get(p.origin_character_id) ?? null
      : null,
    labels: (labelMap[p.id] ?? []).map((l) => l.slug),
  }));

  return (
    <div className="container max-w-5xl space-y-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            My Perks
          </h1>
          <p className="mt-2 text-muted-foreground">
            Mark which perks you own. This stays private to you and will power the
            “owned perks only” options in build creation and the generator.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/builds/generate?owned=1">Generate using my owned perks</Link>
        </Button>
      </header>

      <MyPerksManager
        perks={items}
        ownedIds={ownedIds}
        labels={labels.map((l) => ({ slug: l.slug, name: l.name }))}
      />
    </div>
  );
}
