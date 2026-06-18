"use server";

import { revalidatePath } from "next/cache";

import {
  setThemeSettings,
  type SettingsResult,
  type ThemeSettings,
} from "@/lib/services/settings.service";

/**
 * Persist theme color changes. setThemeSettings is staff-guarded, validates
 * hex, and busts the cached settings read (revalidateTag), so the runtime CSS
 * injection picks up the new values on the next request — no rebuild.
 */
export async function saveThemeAction(
  partial: Partial<ThemeSettings>,
): Promise<SettingsResult> {
  const r = await setThemeSettings(partial);
  if (r.ok) revalidatePath("/admin/theme");
  return r;
}
