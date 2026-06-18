"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { AuthorizationError } from "@/lib/auth/authz";
import {
  createComment,
  deleteComment,
  toggleFavorite,
  toggleLike,
  type CommentView,
} from "@/lib/services/engagement.service";
import {
  deleteBuildAsStaff,
  getBuildSlugById,
} from "@/lib/services/builds.service";
import { commentSchema } from "@/lib/validations/build";

/**
 * Server actions for community engagement. These are thin: validate input,
 * delegate to engagement.service (which enforces auth + approved-build rules),
 * then revalidate affected paths. Authorization is NEVER trusted from the client.
 */

const uuidSchema = z.string().uuid();

export type LikeResult =
  | { ok: true; liked: boolean; count: number }
  | { ok: false; error: string };

export type FavoriteResult =
  | { ok: true; saved: boolean }
  | { ok: false; error: string };

export type CommentResult =
  | { ok: true; comment: CommentView }
  | { ok: false; error: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

function toError(err: unknown): string {
  if (err instanceof AuthorizationError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

/** Revalidate the build's detail page (by slug) and the public list. */
async function revalidateBuild(buildId: string): Promise<void> {
  const slug = await getBuildSlugById(buildId);
  if (slug) revalidatePath(`/builds/${slug}`);
  revalidatePath("/builds");
}

export async function toggleLikeAction(buildId: unknown): Promise<LikeResult> {
  const parsed = uuidSchema.safeParse(buildId);
  if (!parsed.success) return { ok: false, error: "Invalid build." };
  try {
    const result = await toggleLike(parsed.data);
    await revalidateBuild(parsed.data);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

export async function toggleFavoriteAction(
  buildId: unknown,
): Promise<FavoriteResult> {
  const parsed = uuidSchema.safeParse(buildId);
  if (!parsed.success) return { ok: false, error: "Invalid build." };
  try {
    const result = await toggleFavorite(parsed.data);
    await revalidateBuild(parsed.data);
    revalidatePath("/account/saved");
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

export async function createCommentAction(
  input: unknown,
): Promise<CommentResult> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check your comment.",
    };
  }
  try {
    const comment = await createComment(parsed.data.build_id, parsed.data.body);
    await revalidateBuild(parsed.data.build_id);
    return { ok: true, comment };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

export async function deleteCommentAction(
  commentId: unknown,
): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(commentId);
  if (!parsed.success) return { ok: false, error: "Invalid comment." };
  try {
    await deleteComment(parsed.data);
    // The comment id alone doesn't give us the slug; revalidate the dynamic
    // build detail route and the list. Detail pages are force-dynamic anyway.
    revalidatePath("/builds/[slug]", "page");
    revalidatePath("/builds");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

/**
 * Staff soft-delete of a build from its detail page. deleteBuildAsStaff
 * self-guards (no-op for non-staff). Redirects back to the builds list.
 */
export async function deleteBuildFromDetailAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) {
    const res = await deleteBuildAsStaff(id);
    if (res.ok) revalidatePath("/builds");
  }
  redirect("/builds");
}
