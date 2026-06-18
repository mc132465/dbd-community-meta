"use server";

import { revalidatePath } from "next/cache";

import {
  setSiteTexts,
  type SettingsResult,
  type SiteTexts,
} from "@/lib/services/settings.service";

/**
 * Persist site texts. setSiteTexts is staff-guarded and busts the cached
 * settings read, so navbar/footer/hero/metadata/announcement pick up changes on
 * the next request — no rebuild.
 */
export async function saveSiteTextsAction(
  partial: Partial<SiteTexts>,
): Promise<SettingsResult> {
  const r = await setSiteTexts(partial);
  if (r.ok) {
    revalidatePath("/admin/settings");
    revalidatePath("/", "layout");
  }
  return r;
}
