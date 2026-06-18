import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  getPublicProfile,
  type PickItem,
} from "@/lib/services/profile-public.service";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isAdmin } from "@/lib/auth/roles";
import { playstyleLabel } from "@/lib/profile/constants";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import { clearProfileAction } from "./actions";

type Params = { params: { username: string } };

export async function generateMetadata({
  params,
}: Params): Promise<Metadata> {
  const p = await getPublicProfile(params.username);
  if (!p) return { title: "Profile" };
  return { title: `@${p.username}`, description: p.bio ?? undefined };
}

function PickRow({ title, items }: { title: string; items: PickItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-2 rounded-full border border-border/60 py-1 pl-1 pr-3 text-sm"
          >
            <AssetThumb
              src={it.image}
              alt={it.name}
              fallbackLabel={initialsFrom(it.name)}
              className="h-6 w-6 rounded-full"
            />
            {it.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function PublicProfilePage({ params }: Params) {
  const profile = await getPublicProfile(params.username);
  if (!profile) notFound();

  const me = await getCurrentProfile();
  const viewerIsAdmin = !!me && isAdmin(me.role);

  return (
    <div className="container max-w-3xl space-y-8 py-12">
      <header className="flex flex-wrap items-center gap-4">
        <AssetThumb
          src={profile.avatarUrl}
          alt={profile.username}
          fallbackLabel={initialsFrom(profile.displayName || profile.username)}
          className="h-20 w-20 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
            {profile.displayName || `@${profile.username}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            @{profile.username} · joined{" "}
            {new Date(profile.joinedAt).toLocaleDateString()}
            {!profile.isPublic ? " · private" : ""}
          </p>
          {profile.detailsVisible && profile.playstyleTags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.playstyleTags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {playstyleLabel(t)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {profile.isOwner ? (
            <Link
              href="/account/profile"
              className="rounded-md border border-border/60 px-3 py-1.5 text-sm hover:border-border"
            >
              Edit profile
            </Link>
          ) : null}
          {viewerIsAdmin && !profile.isOwner ? (
            <form action={clearProfileAction}>
              <input type="hidden" name="userId" value={profile.id} />
              <input type="hidden" name="username" value={profile.username} />
              <button className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                Clear profile (admin)
              </button>
            </form>
          ) : null}
        </div>
      </header>

      {!profile.detailsVisible ? (
        <p className="rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          This profile is private.
        </p>
      ) : (
        <>
          {profile.bio ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {profile.bio}
            </p>
          ) : null}

          <div className="flex gap-6 text-sm">
            <span>
              <strong className="tabular-nums">{profile.buildCount}</strong>{" "}
              <span className="text-muted-foreground">builds</span>
            </span>
            <span>
              <strong className="tabular-nums">{profile.tierListCount}</strong>{" "}
              <span className="text-muted-foreground">tier lists</span>
            </span>
          </div>

          <section className="space-y-4">
            <PickRow title="Top Killers" items={profile.picks.favKillers} />
            <PickRow
              title="Most Hated Killer"
              items={profile.picks.hatedKiller ? [profile.picks.hatedKiller] : []}
            />
          </section>

          {profile.publicBuilds.length > 0 ? (
            <section>
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
                Public builds
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                {profile.publicBuilds.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/builds/${b.slug}`}
                      className="text-link hover:text-link-hover"
                    >
                      {b.title || `${b.characterName ?? "Build"} loadout`}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {profile.publicTierLists.length > 0 ? (
            <section>
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
                Tier lists
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                {profile.publicTierLists.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/tier-lists/${t.slug}`}
                      className="text-link hover:text-link-hover"
                    >
                      {t.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {profile.favoriteBuilds.length > 0 ? (
            <section>
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
                Favorite builds
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                {profile.favoriteBuilds.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/builds/${b.slug}`}
                      className="text-link hover:text-link-hover"
                    >
                      {b.title || `${b.characterName ?? "Build"} loadout`}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
