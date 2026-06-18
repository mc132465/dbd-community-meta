"use server";

import { revalidatePath } from "next/cache";

import {
  assignImageManually,
  resetImageToAuto,
  type AssetResult,
} from "@/lib/services/asset-admin.service";

const BASE = "/admin/assets/packs";

export async function assignImageAction(
  imageId: string,
  assetId: string,
): Promise<AssetResult> {
  const r = await assignImageManually({ imageId, assetId });
  if (r.ok) {
    revalidatePath(BASE);
    revalidatePath("/perks");
    revalidatePath("/characters");
  }
  return r;
}

export async function resetImageAction(imageId: string): Promise<AssetResult> {
  const r = await resetImageToAuto(imageId);
  if (r.ok) {
    revalidatePath(BASE);
    revalidatePath("/perks");
    revalidatePath("/characters");
  }
  return r;
}
