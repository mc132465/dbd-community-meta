"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { submitBuildEdit } from "@/lib/services/build-revisions.service";
import { isModerator } from "@/lib/auth/roles";
import { communityBuildSchema } from "@/lib/validations/build";
import { buildSlug } from "@/lib/builds/constants";

export type SubmitResult =
  | { ok: true; slug: string; status: string }
  | { ok: false; error: string };

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "23505";
}

/**
 * Submits a community build (structured data only). Regular users land in
 * `pending_review`; staff submissions are auto-`approved`. Editorial content is
 * never written here.
 */
export async function submitBuildAction(input: unknown): Promise<SubmitResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "You must be signed in." };

  const parsed = communityBuildSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  }
  const data = parsed.data;

  const status = isModerator(profile.role) ? "approved" : "pending_review";
  const titleBase = (data.title || "").trim();
  const slugBase = titleBase || data.role;

  // Insert the build (retry once on the unlikely slug collision).
  let buildId: string | null = null;
  let createdSlug: string | null = null;
  for (let attempt = 0; attempt < 2 && !buildId; attempt++) {
    try {
      const created = await db
        .insertInto("builds")
        .values({
          author_id: profile.id,
          title: titleBase || null,
          slug: buildSlug(slugBase),
          role: data.role,
          character_id: data.character_id,
          difficulty_suggestion: data.difficulty_suggestion || null,
          status,
          reviewed_by: status === "approved" ? profile.id : null,
          reviewed_at: status === "approved" ? new Date().toISOString() : null,
        })
        .returning(["id", "slug"])
        .executeTakeFirstOrThrow();
      buildId = created.id;
      createdSlug = created.slug;
    } catch (err) {
      if (isUniqueViolation(err)) continue; // slug collision, retry
      return { ok: false, error: "Could not save your build. Try again." };
    }
  }

  if (!buildId || !createdSlug) {
    return { ok: false, error: "Could not save your build. Try again." };
  }

  // Loadout rows.
  if (data.perk_ids.length > 0) {
    await db
      .insertInto("build_perks")
      .values(
        data.perk_ids.slice(0, 4).map((perk_id, i) => ({
          build_id: buildId as string,
          perk_id,
          slot: i + 1,
        })),
      )
      .execute();
  }
  if (data.add_on_ids.length > 0) {
    await db
      .insertInto("build_add_ons")
      .values(
        data.add_on_ids.slice(0, 2).map((add_on_id, i) => ({
          build_id: buildId as string,
          add_on_id,
          slot: i + 1,
        })),
      )
      .execute();
  }
  if (data.item_id) {
    await db
      .insertInto("build_item")
      .values({ build_id: buildId, item_id: data.item_id })
      .execute();
  }
  if (data.tag_ids.length > 0) {
    await db
      .insertInto("build_tags")
      .values(data.tag_ids.map((tag_id) => ({ build_id: buildId as string, tag_id })))
      .execute();
  }

  revalidatePath("/builds");
  revalidatePath("/builds/mine");
  if (status === "approved") revalidatePath("/admin/builds");

  return { ok: true, slug: createdSlug, status };
}

/**
 * Author edits an existing build. For a public (approved/archived) build this
 * creates/overwrites a pending revision (live build untouched); for a not-yet-
 * public build it edits in place. Editorial layer and slug are never touched.
 */
export type EditResult =
  | { ok: true; status: "pending_review" | "edited" }
  | { ok: false; error: string };

export async function submitBuildEditAction(
  buildId: string,
  input: unknown,
  note: string,
): Promise<EditResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "You must be signed in." };

  const parsed = communityBuildSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  }
  const d = parsed.data;
  const r = await submitBuildEdit(
    buildId,
    {
      title: d.title || null,
      role: d.role,
      character_id: d.character_id,
      difficulty_suggestion: d.difficulty_suggestion || null,
      item_id: d.item_id || null,
      perk_ids: d.perk_ids,
      add_on_ids: d.add_on_ids,
      tag_ids: d.tag_ids,
    },
    note,
  );
  if (r.ok) {
    revalidatePath("/builds");
    revalidatePath("/builds/mine");
    revalidatePath("/admin/builds/queue");
  }
  return r;
}
