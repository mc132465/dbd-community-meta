import "server-only";

import { db } from "@/lib/db/kysely";
import { getViewer } from "@/lib/auth/authz";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isAdmin } from "@/lib/auth/roles";
import {
  listBuildCardsByIds,
  listBuildsByAuthor,
} from "@/lib/services/builds.service";
import {
  PICK_CAPS,
  PLAYSTYLE_KEYS,
  PRESET_AVATARS,
} from "@/lib/profile/constants";
import type {
  ProfilePickKind,
  ProfileRow,
  UserRole,
} from "@/types/database";

export type PickItem = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
};

export type ProfileBuildLite = {
  id: string;
  slug: string;
  title: string | null;
  characterName: string | null;
  characterImage: string | null;
};

export type ProfileTierLite = { id: string; slug: string; title: string };

export type ProfilePicks = {
  favKillers: PickItem[];
  hatedKiller: PickItem | null;
};

export type PublicProfileView = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  joinedAt: string;
  isPublic: boolean;
  isOwner: boolean;
  isStaffViewer: boolean;
  /** When false, detailed sections are hidden (private profile, other viewer). */
  detailsVisible: boolean;
  playstyleTags: string[];
  picks: ProfilePicks;
  buildCount: number;
  tierListCount: number;
  publicBuilds: ProfileBuildLite[];
  favoriteBuilds: ProfileBuildLite[];
  publicTierLists: ProfileTierLite[];
};

function emptyPicks(): ProfilePicks {
  return {
    favKillers: [],
    hatedKiller: null,
  };
}

/** Load and group a profile's killer picks (resolved to names + icons). */
export async function loadProfilePicks(profileId: string): Promise<ProfilePicks> {
  const rows = await db
    .selectFrom("profile_picks as pp")
    .innerJoin("characters as c", "c.id", "pp.character_id")
    .select([
      "pp.kind as kind",
      "pp.rank as rank",
      "c.id as c_id",
      "c.name as c_name",
      "c.slug as c_slug",
      "c.image_url as c_image",
    ])
    .where("pp.profile_id", "=", profileId)
    .where("pp.kind", "in", ["fav_killer", "hated_killer"])
    .orderBy("pp.kind")
    .orderBy("pp.rank")
    .orderBy("pp.created_at")
    .execute();

  const picks = emptyPicks();
  for (const r of rows) {
    if (!r.c_id) continue;
    const item: PickItem = {
      id: r.c_id,
      name: r.c_name ?? "Character",
      slug: r.c_slug ?? "",
      image: r.c_image ?? null,
    };
    if (r.kind === "fav_killer") {
      picks.favKillers.push(item);
    } else if (r.kind === "hated_killer") {
      if (!picks.hatedKiller) picks.hatedKiller = item;
    }
  }
  return picks;
}

function toBuildLite(b: {
  id: string;
  slug: string;
  title: string | null;
  characters: { name: string; image_url: string | null } | null;
}): ProfileBuildLite {
  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    characterName: b.characters?.name ?? null,
    characterImage: b.characters?.image_url ?? null,
  };
}

/**
 * Assemble a profile for viewing. Respects privacy: a private profile shows only
 * its identity shell to other users; the owner and staff always see everything.
 */
export async function getPublicProfile(
  username: string,
): Promise<PublicProfileView | null> {
  const profile = (await db
    .selectFrom("profiles")
    .selectAll()
    .where("username", "=", username)
    .executeTakeFirst()) as ProfileRow | undefined;
  if (!profile) return null;

  const viewer = await getViewer();
  const isOwner = viewer.userId !== null && viewer.userId === profile.id;
  const isStaffViewer = viewer.isStaff;
  const detailsVisible = profile.is_public || isOwner || isStaffViewer;

  const base: PublicProfileView = {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    bio: detailsVisible ? profile.bio : null,
    role: profile.role,
    joinedAt: profile.created_at,
    isPublic: profile.is_public,
    isOwner,
    isStaffViewer,
    detailsVisible,
    playstyleTags: detailsVisible ? profile.playstyle_tags ?? [] : [],
    picks: emptyPicks(),
    buildCount: 0,
    tierListCount: 0,
    publicBuilds: [],
    favoriteBuilds: [],
    publicTierLists: [],
  };
  if (!detailsVisible) return base;

  const [picks, authored, favRows, tierLists] = await Promise.all([
    loadProfilePicks(profile.id),
    listBuildsByAuthor(profile.id),
    db
      .selectFrom("build_favorites")
      .select("build_id")
      .where("user_id", "=", profile.id)
      .execute(),
    db
      .selectFrom("tier_lists")
      .select(["id", "slug", "title"])
      .where("author_id", "=", profile.id)
      .where("status", "=", "published")
      .orderBy("created_at", "desc")
      .execute(),
  ]);

  const publicAuthored = authored.filter(
    (b) => b.status === "approved" && b.deleted_at === null,
  );
  const favoriteCards = await listBuildCardsByIds(
    favRows.map((r) => r.build_id),
  );

  base.picks = picks;
  base.buildCount = publicAuthored.length;
  base.tierListCount = tierLists.length;
  base.publicBuilds = publicAuthored.map(toBuildLite);
  base.favoriteBuilds = favoriteCards.map(toBuildLite);
  base.publicTierLists = tierLists as ProfileTierLite[];
  return base;
}

// ---------- owner mutations ----------

export type ProfileResult = { ok: true } | { ok: false; error: string };

export type ProfileSettingsInput = {
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  isPublic: boolean;
  playstyleTags: string[];
};

/** Update the signed-in user's profile settings (owner only). */
export async function updateProfileSettings(
  input: ProfileSettingsInput,
): Promise<ProfileResult> {
  const me = await getCurrentProfile();
  if (!me) return { ok: false, error: "Sign in first." };

  const displayName = input.displayName.trim().slice(0, 50) || null;
  const bio = input.bio.trim().slice(0, 500) || null;
  const avatarUrl =
    input.avatarUrl && PRESET_AVATARS.includes(input.avatarUrl)
      ? input.avatarUrl
      : null;
  const playstyleTags = [...new Set(input.playstyleTags)].filter((t) =>
    PLAYSTYLE_KEYS.includes(t),
  );

  try {
    await db
      .updateTable("profiles")
      .set({
        display_name: displayName,
        bio,
        avatar_url: avatarUrl,
        is_public: input.isPublic,
        playstyle_tags: playstyleTags,
      })
      .where("id", "=", me.id)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/**
 * Replace the picks for one kind (owner only). Validates the cap and that the
 * ids exist and are the correct kind of target. Order = array order (rank).
 */
export async function setProfilePicks(
  kind: ProfilePickKind,
  ids: string[],
): Promise<ProfileResult> {
  const me = await getCurrentProfile();
  if (!me) return { ok: false, error: "Sign in first." };

  const cap = PICK_CAPS[kind];
  if (cap === undefined) return { ok: false, error: "Unknown pick type." };
  const wanted = [...new Set(ids)].slice(0, cap);

  // Only killer (character) picks remain; validate the ids are killers.
  let valid: string[] = [];
  if (wanted.length > 0) {
    const rows = await db
      .selectFrom("characters")
      .select("id")
      .where("id", "in", wanted)
      .where("role", "=", "killer")
      .execute();
    const ok = new Set(rows.map((r) => r.id));
    valid = wanted.filter((id) => ok.has(id));
  }

  try {
    await db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("profile_picks")
        .where("profile_id", "=", me.id)
        .where("kind", "=", kind)
        .execute();
      if (valid.length > 0) {
        await trx
          .insertInto("profile_picks")
          .values(
            valid.map((id, i) => ({
              profile_id: me.id,
              kind,
              character_id: id,
              perk_id: null,
              rank: i,
            })),
          )
          .execute();
      }
    });
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

// ---------- admin moderation ----------

/** Blank a user's bio + avatar and clear their picks (admin only). */
export async function adminClearProfile(
  userId: string,
): Promise<ProfileResult> {
  const me = await getCurrentProfile();
  if (!me || !isAdmin(me.role)) return { ok: false, error: "Admin only." };
  try {
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("profiles")
        .set({ bio: null, avatar_url: null })
        .where("id", "=", userId)
        .execute();
      await trx
        .deleteFrom("profile_picks")
        .where("profile_id", "=", userId)
        .execute();
    });
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}
