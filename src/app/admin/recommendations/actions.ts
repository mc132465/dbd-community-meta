"use server";

import { revalidatePath } from "next/cache";

import {
  addRecommendation,
  deleteRecommendation,
  updateRecommendation,
  type RecResult,
} from "@/lib/services/recommendations.service";
import { recordAudit } from "@/lib/services/audit.service";

function revalidate() {
  revalidatePath("/admin/recommendations");
  revalidatePath("/builds/new");
}

export async function addRecommendationAction(
  characterId: string,
  perkId: string,
  note: string,
  sortOrder: number,
): Promise<RecResult> {
  const r = await addRecommendation({ characterId, perkId, note, sortOrder });
  if (r.ok) {
    await recordAudit("recommendation.add", "perk_recommendation", null, {
      characterId,
      perkId,
    });
    revalidate();
  }
  return r;
}

export async function toggleRecommendationAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";
  if (id) await updateRecommendation(id, { isActive });
  revalidate();
}

export async function saveRecommendationAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "");
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  if (id) {
    await updateRecommendation(id, {
      note,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    });
  }
  revalidate();
}

export async function deleteRecommendationAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteRecommendation(id);
    await recordAudit("recommendation.delete", "perk_recommendation", id, {});
  }
  revalidate();
}
