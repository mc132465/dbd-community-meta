import "server-only";

import { sql } from "kysely";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import { recordBuildVersion } from "@/lib/services/build-versions.service";
import type {
  BuildRevisionContent,
  BuildRevisionRow,
  GameRole,
  RevisionStatus,
} from "@/types/database";

export type RevisionResult = { ok: true } | { ok: false; error: string };
export type SubmitRevisionResult =
  | { ok: true; status: "pending_review" | "edited" }
  | { ok: false; error: string };

async function requireStaffId(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) {
    return { ok: false, error: "Not authorized." };
  }
  return { ok: true, id: profile.id };
}

/** Keep only ids that still exist in `table`, preserving the given order. */
async function existingIds(
  table: "perks" | "add_ons" | "items" | "tags" | "characters",
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .selectFrom(table)
    .select("id")
    .where("id", "in", ids)
    .execute();
  const ok = new Set(rows.map((r) => r.id as string));
  return ids.filter((id) => ok.has(id));
}

/** Build a content snapshot from the live build + its loadout. */
export async function snapshotFromBuild(
  buildId: string,
): Promise<BuildRevisionContent | null> {
  const b = await db
    .selectFrom("builds")
    .select(["title", "role", "character_id", "difficulty_suggestion"])
    .where("id", "=", buildId)
    .executeTakeFirst();
  if (!b) return null;

  const [perks, addOns, item, tags] = await Promise.all([
    db
      .selectFrom("build_perks")
      .select(["perk_id", "slot"])
      .where("build_id", "=", buildId)
      .orderBy("slot")
      .execute(),
    db
      .selectFrom("build_add_ons")
      .select(["add_on_id", "slot"])
      .where("build_id", "=", buildId)
      .orderBy("slot")
      .execute(),
    db
      .selectFrom("build_item")
      .select("item_id")
      .where("build_id", "=", buildId)
      .executeTakeFirst(),
    db
      .selectFrom("build_tags")
      .select("tag_id")
      .where("build_id", "=", buildId)
      .execute(),
  ]);

  return {
    title: b.title ?? null,
    role: b.role as GameRole,
    character_id: (b.character_id as string) ?? "",
    difficulty_suggestion: b.difficulty_suggestion ?? null,
    item_id: item?.item_id ?? null,
    perk_ids: perks.map((p) => p.perk_id),
    add_on_ids: addOns.map((a) => a.add_on_id),
    tag_ids: tags.map((t) => t.tag_id),
  };
}

/**
 * Author submits an edit. If the build is approved/archived (public), the edit
 * becomes a pending revision (overwriting any open one) and the live build is
 * untouched. If the build isn't public yet (the author's own pending/rejected
 * build), the edit is applied in place — no revision needed.
 */
export async function submitBuildEdit(
  buildId: string,
  content: BuildRevisionContent,
  authorNote: string,
): Promise<SubmitRevisionResult> {
  const me = await getCurrentProfile();
  if (!me) return { ok: false, error: "Sign in first." };

  const build = await db
    .selectFrom("builds")
    .select(["author_id", "status", "deleted_at"])
    .where("id", "=", buildId)
    .executeTakeFirst();
  if (!build || build.deleted_at) return { ok: false, error: "Build not found." };

  const isOwner = build.author_id === me.id;
  if (!isOwner && !isModerator(me.role)) {
    return { ok: false, error: "You can only edit your own build." };
  }

  const isPublic = build.status === "approved" || build.status === "archived";

  if (!isPublic) {
    // Not live yet → edit in place.
    const r = await applyContent(buildId, content);
    return r.ok ? { ok: true, status: "edited" } : r;
  }

  const base = await snapshotFromBuild(buildId);
  const contentJson = sql<BuildRevisionContent>`${JSON.stringify(content)}::jsonb`;
  const baseJson = sql<BuildRevisionContent>`${JSON.stringify(base)}::jsonb`;

  try {
    // Overwrite the open revision if one exists, else create it.
    const open = await db
      .selectFrom("build_revisions")
      .select("id")
      .where("build_id", "=", buildId)
      .where("status", "=", "pending_review")
      .executeTakeFirst();

    if (open) {
      await db
        .updateTable("build_revisions")
        .set({
          content: contentJson,
          base_snapshot: baseJson,
          author_note: authorNote || null,
          author_id: me.id,
          updated_at: new Date().toISOString(),
        })
        .where("id", "=", open.id)
        .execute();
    } else {
      await db
        .insertInto("build_revisions")
        .values({
          build_id: buildId,
          author_id: me.id,
          status: "pending_review",
          content: contentJson,
          base_snapshot: baseJson,
          author_note: authorNote || null,
        })
        .execute();
    }
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true, status: "pending_review" };
}

/** Apply a content payload to a build + replace its loadout (validated). */
async function applyContent(
  buildId: string,
  content: BuildRevisionContent,
): Promise<RevisionResult> {
  const character = await existingIds("characters", [content.character_id]);
  if (character.length === 0) {
    return { ok: false, error: "The selected character no longer exists." };
  }
  const perks = (await existingIds("perks", content.perk_ids)).slice(0, 4);
  if (perks.length === 0) {
    return { ok: false, error: "At least one valid perk is required." };
  }
  const addOns = (await existingIds("add_ons", content.add_on_ids)).slice(0, 2);
  const tags = await existingIds("tags", content.tag_ids);
  const item =
    content.item_id && (await existingIds("items", [content.item_id])).length > 0
      ? content.item_id
      : null;

  try {
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("builds")
        .set({
          title: content.title || null,
          role: content.role,
          character_id: content.character_id,
          difficulty_suggestion: content.difficulty_suggestion || null,
          updated_at: new Date().toISOString(),
        })
        .where("id", "=", buildId)
        .execute();

      await trx.deleteFrom("build_perks").where("build_id", "=", buildId).execute();
      await trx
        .insertInto("build_perks")
        .values(perks.map((perk_id, i) => ({ build_id: buildId, perk_id, slot: i + 1 })))
        .execute();

      await trx
        .deleteFrom("build_add_ons")
        .where("build_id", "=", buildId)
        .execute();
      if (addOns.length > 0) {
        await trx
          .insertInto("build_add_ons")
          .values(
            addOns.map((add_on_id, i) => ({ build_id: buildId, add_on_id, slot: i + 1 })),
          )
          .execute();
      }

      await trx.deleteFrom("build_item").where("build_id", "=", buildId).execute();
      if (item) {
        await trx
          .insertInto("build_item")
          .values({ build_id: buildId, item_id: item })
          .execute();
      }

      await trx.deleteFrom("build_tags").where("build_id", "=", buildId).execute();
      if (tags.length > 0) {
        await trx
          .insertInto("build_tags")
          .values(tags.map((tag_id) => ({ build_id: buildId, tag_id })))
          .execute();
      }
    });
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed to apply." };
  }
  return { ok: true };
}

// ---------- reads ----------

/** The open (pending) revision for a build, if any. */
export async function getOpenRevision(
  buildId: string,
): Promise<BuildRevisionRow | null> {
  const row = await db
    .selectFrom("build_revisions")
    .selectAll()
    .where("build_id", "=", buildId)
    .where("status", "=", "pending_review")
    .executeTakeFirst();
  return (row as BuildRevisionRow | undefined) ?? null;
}

export type PendingRevisionListItem = {
  id: string;
  buildId: string;
  buildSlug: string;
  buildTitle: string | null;
  authorUsername: string;
  createdAt: string;
};

/** Pending revisions for the staff queue. */
export async function listPendingRevisions(): Promise<PendingRevisionListItem[]> {
  const rows = await db
    .selectFrom("build_revisions as r")
    .innerJoin("builds as b", "b.id", "r.build_id")
    .innerJoin("profiles as p", "p.id", "r.author_id")
    .select([
      "r.id as id",
      "r.build_id as buildId",
      "b.slug as buildSlug",
      "b.title as buildTitle",
      "p.username as authorUsername",
      "r.created_at as createdAt",
    ])
    .where("r.status", "=", "pending_review")
    .orderBy("r.created_at", "asc")
    .execute();
  return rows as PendingRevisionListItem[];
}

export async function getRevisionById(
  revisionId: string,
): Promise<BuildRevisionRow | null> {
  const row = await db
    .selectFrom("build_revisions")
    .selectAll()
    .where("id", "=", revisionId)
    .executeTakeFirst();
  return (row as BuildRevisionRow | undefined) ?? null;
}

/** Count of open revisions (for the admin nav badge). */
export async function countPendingRevisions(): Promise<number> {
  const row = await db
    .selectFrom("build_revisions")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("status", "=", "pending_review")
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

// ---------- staff approve / reject ----------

export async function approveRevision(
  revisionId: string,
  note: string,
): Promise<RevisionResult> {
  const auth = await requireStaffId();
  if (!auth.ok) return auth;

  const rev = await getRevisionById(revisionId);
  if (!rev || rev.status !== "pending_review") {
    return { ok: false, error: "Revision not open." };
  }
  const build = await db
    .selectFrom("builds")
    .select(["status", "deleted_at"])
    .where("id", "=", rev.build_id)
    .executeTakeFirst();
  if (!build || build.deleted_at) {
    return { ok: false, error: "The live build is gone; cannot apply." };
  }

  const applied = await applyContent(rev.build_id, rev.content);
  if (!applied.ok) return applied;

  try {
    await db
      .updateTable("build_revisions")
      .set({
        status: "approved",
        review_note: note || null,
        reviewed_by: auth.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", revisionId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }

  // Append a version-history entry (best-effort; the author is the revision author).
  await recordBuildVersion({
    buildId: rev.build_id,
    kind: "revision",
    content: rev.content,
    authorId: rev.author_id,
    note: note || null,
  });

  return { ok: true };
}

export async function rejectRevision(
  revisionId: string,
  note: string,
): Promise<RevisionResult> {
  const auth = await requireStaffId();
  if (!auth.ok) return auth;

  try {
    await db
      .updateTable("build_revisions")
      .set({
        status: "rejected" as RevisionStatus,
        review_note: note || null,
        reviewed_by: auth.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", revisionId)
      .where("status", "=", "pending_review")
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}
