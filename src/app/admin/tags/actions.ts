"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import { slugify } from "@/lib/builds/constants";
import { tagCategorySchema, tagSchema } from "@/lib/validations/build";

export type TagResult = { ok: true } | { ok: false; error: string };

async function requireStaff() {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) {
    return { ok: false as const, error: "Not authorized." };
  }
  return { ok: true as const };
}

function mapError(err: unknown): string {
  if ((err as { code?: string })?.code === "23505") {
    return "That slug already exists.";
  }
  return (err as Error)?.message ?? "Something went wrong.";
}

export async function createTag(input: unknown): Promise<TagResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid tag." };
  }
  const d = parsed.data;

  try {
    await db
      .insertInto("tags")
      .values({
        name: d.name,
        slug: d.slug ? slugify(d.slug) : slugify(d.name),
        category_id: d.category_id || null,
        is_active: d.is_active,
      })
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function updateTag(id: string, input: unknown): Promise<TagResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid tag." };
  }
  const d = parsed.data;

  try {
    await db
      .updateTable("tags")
      .set({
        name: d.name,
        slug: d.slug ? slugify(d.slug) : slugify(d.name),
        category_id: d.category_id || null,
        is_active: d.is_active,
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", id)
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidatePath("/admin/tags");
  revalidatePath("/builds");
  return { ok: true };
}

export async function setTagActive(
  id: string,
  isActive: boolean,
): Promise<TagResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  try {
    await db
      .updateTable("tags")
      .set({ is_active: isActive, updated_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidatePath("/admin/tags");
  revalidatePath("/builds");
  return { ok: true };
}

export async function deleteTag(id: string): Promise<TagResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  try {
    await db.deleteFrom("tags").where("id", "=", id).execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidatePath("/admin/tags");
  revalidatePath("/builds");
  return { ok: true };
}

export async function createCategory(input: unknown): Promise<TagResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const parsed = tagCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid category.",
    };
  }
  const d = parsed.data;

  try {
    await db
      .insertInto("tag_categories")
      .values({ name: d.name, slug: slugify(d.name), sort_order: d.sort_order })
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidatePath("/admin/tags");
  return { ok: true };
}
