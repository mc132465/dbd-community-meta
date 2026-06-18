"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addEntry,
  archiveTierList,
  createTierList,
  deleteTierList,
  moveEntry,
  publishTierList,
  removeEntry,
  updateTierLabels,
  updateTierList,
  type AddEntryResult,
  type CreateTierResult,
  type TierResult,
} from "@/lib/services/tier-list-editor.service";

/**
 * Tier-list editor actions. The author is resolved inside the service; staff
 * can manage any list. Each write revalidates the edit page (and the overview).
 */

function revalidate(slug?: string) {
  revalidatePath("/tier-lists");
  if (slug) revalidatePath(`/tier-lists/${slug}/edit`);
}

export async function createTierListAction(
  input: unknown,
): Promise<CreateTierResult> {
  const r = await createTierList(input);
  if (r.ok) revalidate(r.slug);
  return r;
}

export async function updateTierListAction(
  tierListId: string,
  slug: string,
  input: unknown,
): Promise<TierResult> {
  const r = await updateTierList(tierListId, input);
  if (r.ok) revalidate(slug);
  return r;
}

export async function updateTierLabelsAction(
  tierListId: string,
  slug: string,
  input: unknown,
): Promise<TierResult> {
  const r = await updateTierLabels(tierListId, input);
  if (r.ok) revalidate(slug);
  return r;
}

export async function publishTierListAction(
  tierListId: string,
  slug: string,
): Promise<TierResult> {
  const r = await publishTierList(tierListId);
  if (r.ok) {
    revalidate(slug);
    revalidatePath(`/tier-lists/${slug}`);
  }
  return r;
}

export async function archiveTierListAction(
  tierListId: string,
  slug: string,
): Promise<TierResult> {
  const r = await archiveTierList(tierListId);
  if (r.ok) revalidate(slug);
  return r;
}

export async function deleteTierListAction(
  tierListId: string,
): Promise<TierResult> {
  const r = await deleteTierList(tierListId);
  if (r.ok) revalidatePath("/tier-lists");
  return r;
}

/**
 * Delete a tier list from its detail page (form action). deleteTierList's
 * ownership check permits the owner OR staff (moderator/admin), so this is the
 * staff moderation path too. Redirects to the tier-list index.
 */
export async function deleteTierListFromDetailAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) {
    const r = await deleteTierList(id);
    if (r.ok) revalidatePath("/tier-lists");
  }
  redirect("/tier-lists");
}

export async function addEntryAction(
  slug: string,
  input: unknown,
): Promise<AddEntryResult> {
  const r = await addEntry(input);
  if (r.ok) revalidate(slug);
  return r;
}

export async function moveEntryAction(
  slug: string,
  input: unknown,
): Promise<TierResult> {
  const r = await moveEntry(input);
  if (r.ok) revalidate(slug);
  return r;
}

export async function removeEntryAction(
  slug: string,
  entryId: string,
): Promise<TierResult> {
  const r = await removeEntry(entryId);
  if (r.ok) revalidate(slug);
  return r;
}
