"use server";

import { revalidatePath } from "next/cache";

import {
  applyPerkLabelFromTierList,
  assignLabelToPerk,
  createPerkLabel,
  createPerkLabelCategory,
  deletePerkLabel,
  removeLabelFromPerk,
  setLabelsForPerk,
  setPerkLabelActive,
  updatePerkLabel,
  type ApplyTierResult,
  type PerkLabelResult,
} from "@/lib/services/perk-labels.service";

const PATH = "/admin/perk-labels";

export async function createPerkLabelAction(
  input: unknown,
): Promise<PerkLabelResult> {
  const r = await createPerkLabel(input);
  if (r.ok) revalidatePath(PATH);
  return r;
}

export async function updatePerkLabelAction(
  id: string,
  input: unknown,
): Promise<PerkLabelResult> {
  const r = await updatePerkLabel(id, input);
  if (r.ok) revalidatePath(PATH);
  return r;
}

export async function setPerkLabelActiveAction(
  id: string,
  isActive: boolean,
): Promise<PerkLabelResult> {
  const r = await setPerkLabelActive(id, isActive);
  if (r.ok) revalidatePath(PATH);
  return r;
}

export async function deletePerkLabelAction(
  id: string,
): Promise<PerkLabelResult> {
  const r = await deletePerkLabel(id);
  if (r.ok) revalidatePath(PATH);
  return r;
}

export async function createPerkLabelCategoryAction(
  input: unknown,
): Promise<PerkLabelResult> {
  const r = await createPerkLabelCategory(input);
  if (r.ok) revalidatePath(PATH);
  return r;
}

// ---------- perk ↔ label assignment ----------

export async function setPerkLabelsAction(
  perkId: string,
  labelIds: string[],
): Promise<PerkLabelResult> {
  const r = await setLabelsForPerk(perkId, labelIds);
  if (r.ok) revalidatePath(`/admin/assets/perks/${perkId}/edit`);
  return r;
}

export async function assignLabelToPerkAction(
  perkId: string,
  labelId: string,
): Promise<PerkLabelResult> {
  const r = await assignLabelToPerk(perkId, labelId);
  if (r.ok) revalidatePath(`/admin/assets/perks/${perkId}/edit`);
  return r;
}

export async function removeLabelFromPerkAction(
  perkId: string,
  labelId: string,
): Promise<PerkLabelResult> {
  const r = await removeLabelFromPerk(perkId, labelId);
  if (r.ok) revalidatePath(`/admin/assets/perks/${perkId}/edit`);
  return r;
}

export async function applyPerkLabelFromTierAction(input: {
  tierListId: string;
  tier: string;
  labelId: string;
}): Promise<ApplyTierResult> {
  const r = await applyPerkLabelFromTierList(input);
  if (r.ok) {
    revalidatePath(PATH);
    revalidatePath("/perks");
  }
  return r;
}
