"use server";

import { revalidatePath } from "next/cache";

import {
  reviewAssign,
  reviewConfirm,
  reviewReject,
  reviewResetAuto,
} from "@/lib/services/asset-review.service";
import { recordAudit } from "@/lib/services/audit.service";

function revalidate() {
  revalidatePath("/admin/assets/review");
  revalidatePath("/admin/assets/mapping");
}

export async function confirmAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) {
    await reviewConfirm(id);
    await recordAudit("asset.confirm", "asset_image", id, {});
  }
  revalidate();
}

export async function rejectAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) {
    await reviewReject(id);
    await recordAudit("asset.reject", "asset_image", id, {});
  }
  revalidate();
}

export async function resetAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) {
    await reviewResetAuto(id);
    await recordAudit("asset.reset_auto", "asset_image", id, {});
  }
  revalidate();
}

export async function assignAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  if (id && assetId) {
    await reviewAssign(id, assetId);
    await recordAudit("asset.manual_map", "asset_image", id, { assetId });
  }
  revalidate();
}
