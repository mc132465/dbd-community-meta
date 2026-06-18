"use server";

import { revalidatePath } from "next/cache";

import {
  setMaintenanceSettings,
  type MaintenanceSettings,
  type SettingsResult,
} from "@/lib/services/settings.service";

/**
 * Toggle maintenance mode / edit the message. Staff-guarded in the service;
 * busts the cached settings read so the root (force-dynamic) layout's gate
 * picks it up on the next request — no rebuild.
 */
export async function saveMaintenanceAction(
  partial: Partial<MaintenanceSettings>,
): Promise<SettingsResult> {
  const r = await setMaintenanceSettings(partial);
  if (r.ok) {
    revalidatePath("/admin/maintenance");
    revalidatePath("/", "layout");
  }
  return r;
}
