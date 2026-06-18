"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import { snapshotFromBuild } from "@/lib/services/build-revisions.service";
import {
  listBuildVersions,
  recordBuildVersion,
} from "@/lib/services/build-versions.service";
import {
  deleteBuildAsStaff,
  restoreBuildAsStaff,
} from "@/lib/services/builds.service";
import { editorialSchema, reviewSchema } from "@/lib/validations/build";

export type StaffResult = { ok: true } | { ok: false; error: string };

async function requireStaff() {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) {
    return { ok: false as const, error: "Not authorized.", profile: null };
  }
  return { ok: true as const, profile };
}

const STATUS_BY_ACTION = {
  approve: "approved",
  reject: "rejected",
  archive: "archived",
} as const;

/** Approve / reject / archive a build (staff only). */
export async function reviewBuildAction(
  buildId: string,
  input: unknown,
): Promise<StaffResult> {
  const auth = await requireStaff();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid review action." };

  try {
    await db
      .updateTable("builds")
      .set({
        status: STATUS_BY_ACTION[parsed.data.action],
        reviewed_by: auth.profile.id,
        reviewed_at: new Date().toISOString(),
        review_note: parsed.data.note || null,
      })
      .where("id", "=", buildId)
      .execute();
  } catch {
    return { ok: false, error: "Could not update the build." };
  }

  // On first approval, seed the version history with the initial 'created' entry.
  if (parsed.data.action === "approve") {
    try {
      const existing = await listBuildVersions(buildId);
      if (existing.length === 0) {
        const build = await db
          .selectFrom("builds")
          .select(["author_id"])
          .where("id", "=", buildId)
          .executeTakeFirst();
        const content = await snapshotFromBuild(buildId);
        if (content) {
          await recordBuildVersion({
            buildId,
            kind: "created",
            content,
            authorId: build?.author_id ?? null,
            note: "Initial version",
          });
        }
      }
    } catch {
      /* best-effort history */
    }
  }

  revalidatePath("/admin/builds");
  revalidatePath("/admin/builds/queue");
  revalidatePath("/builds");
  return { ok: true };
}

/** Create/update the staff editorial layer for a build (staff only). */
export async function saveEditorialAction(
  buildId: string,
  input: unknown,
): Promise<StaffResult> {
  const auth = await requireStaff();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = editorialSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid editorial content." };
  const data = parsed.data;

  const editorialValues = {
    overall_strategy: data.overall_strategy || null,
    strengths: data.strengths || null,
    weaknesses: data.weaknesses || null,
    recommended_difficulty: data.recommended_difficulty || null,
    is_featured: data.is_featured,
    editor_id: auth.profile.id,
    published_at: data.published ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  try {
    await db
      .insertInto("build_editorials")
      .values({ build_id: buildId, ...editorialValues })
      .onConflict((oc) => oc.column("build_id").doUpdateSet(editorialValues))
      .execute();

    // Official tags: replace the set.
    await db
      .deleteFrom("build_editorial_tags")
      .where("build_id", "=", buildId)
      .execute();
    if (data.official_tag_ids.length > 0) {
      await db
        .insertInto("build_editorial_tags")
        .values(data.official_tag_ids.map((tag_id) => ({ build_id: buildId, tag_id })))
        .execute();
    }

    // Per-perk explanations: upsert non-empty, delete cleared ones.
    const toUpsert = data.perk_reasons.filter((r) => r.reason.trim().length > 0);
    const toClear = data.perk_reasons
      .filter((r) => r.reason.trim().length === 0)
      .map((r) => r.slot);

    if (toUpsert.length > 0) {
      await db
        .insertInto("build_perk_explanations")
        .values(
          toUpsert.map((r) => ({
            build_id: buildId,
            slot: r.slot,
            reason: r.reason.trim(),
            editor_id: auth.profile.id,
            updated_at: new Date().toISOString(),
          })),
        )
        .onConflict((oc) =>
          oc.columns(["build_id", "slot"]).doUpdateSet((eb) => ({
            reason: eb.ref("excluded.reason"),
            editor_id: eb.ref("excluded.editor_id"),
            updated_at: eb.ref("excluded.updated_at"),
          })),
        )
        .execute();
    }
    if (toClear.length > 0) {
      await db
        .deleteFrom("build_perk_explanations")
        .where("build_id", "=", buildId)
        .where("slot", "in", toClear)
        .execute();
    }
  } catch {
    return { ok: false, error: "Could not save editorial content." };
  }

  revalidatePath("/admin/builds");
  revalidatePath("/builds");
  return { ok: true };
}

/** Soft-delete a build from the admin panel (form action). Staff only. */
export async function deleteBuildAction(formData: FormData): Promise<void> {
  const auth = await requireStaff();
  if (!auth.ok) return;
  const id = String(formData.get("id") ?? "");
  if (id) await deleteBuildAsStaff(id);
  revalidatePath("/admin/builds");
  revalidatePath("/builds");
}

/** Restore a soft-deleted build from the admin panel (form action). Staff only. */
export async function restoreBuildAction(formData: FormData): Promise<void> {
  const auth = await requireStaff();
  if (!auth.ok) return;
  const id = String(formData.get("id") ?? "");
  if (id) await restoreBuildAsStaff(id);
  revalidatePath("/admin/builds");
  revalidatePath("/builds");
}
