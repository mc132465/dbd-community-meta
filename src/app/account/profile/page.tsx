import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { loadProfilePicks } from "@/lib/services/profile-public.service";
import { listCharacters } from "@/lib/services/assets.service";
import { PICK_CAPS } from "@/lib/profile/constants";
import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";
import { PickEditor, type PickOption } from "@/components/profile/pick-editor";

export const metadata: Metadata = { title: "Edit profile · Account" };

export default async function EditProfilePage() {
  const me = await getCurrentProfile();
  if (!me) redirect("/login?next=/account/profile");

  const [picks, killers] = await Promise.all([
    loadProfilePicks(me.id),
    listCharacters("killer"),
  ]);

  const killerOpts: PickOption[] = killers.map((c) => ({
    id: c.id,
    name: c.name,
    image: c.image_url,
  }));

  return (
    <div className="container max-w-2xl space-y-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Edit profile
        </h1>
        <Link
          href={`/u/${me.username}`}
          className="text-sm text-link hover:text-link-hover"
        >
          View public profile →
        </Link>
      </div>

      <ProfileSettingsForm
        initial={{
          displayName: me.display_name ?? "",
          bio: me.bio ?? "",
          avatarUrl: me.avatar_url,
          isPublic: me.is_public,
          playstyleTags: me.playstyle_tags ?? [],
        }}
      />

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
          Gameplay preferences
        </h2>
        <PickEditor
          kind="fav_killer"
          label="Top Killers"
          description="Your favorite killers to play."
          options={killerOpts}
          initial={picks.favKillers}
          cap={PICK_CAPS.fav_killer}
        />
        <PickEditor
          kind="hated_killer"
          label="Most Hated Killer"
          description="The killer you least enjoy facing."
          options={killerOpts}
          initial={picks.hatedKiller ? [picks.hatedKiller] : []}
          cap={PICK_CAPS.hated_killer}
        />
      </section>
    </div>
  );
}
