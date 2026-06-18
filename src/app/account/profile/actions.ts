"use server";

import { revalidatePath } from "next/cache";

import {
  setProfilePicks,
  updateProfileSettings,
  type ProfileResult,
  type ProfileSettingsInput,
} from "@/lib/services/profile-public.service";
import type { ProfilePickKind } from "@/types/database";

export async function saveProfileSettingsAction(
  input: ProfileSettingsInput,
): Promise<ProfileResult> {
  const r = await updateProfileSettings(input);
  if (r.ok) revalidatePath("/account/profile");
  return r;
}

export async function savePicksAction(
  kind: ProfilePickKind,
  ids: string[],
): Promise<ProfileResult> {
  const r = await setProfilePicks(kind, ids);
  if (r.ok) revalidatePath("/account/profile");
  return r;
}
