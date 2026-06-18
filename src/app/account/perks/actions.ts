"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/services/profile.service";
import {
  clearOwnedPerks,
  setManyOwned,
  setPerkOwned,
  type OwnedPerksResult,
} from "@/lib/services/owned-perks.service";

const PATH = "/account/perks";

/**
 * The authenticated user's id is always resolved server-side from the session.
 * The client never sends a user id — these actions only ever affect the caller.
 */
async function currentUserId(): Promise<string | null> {
  const profile = await getCurrentProfile();
  return profile?.id ?? null;
}

export async function setOwnedPerkAction(
  perkId: string,
  owned: boolean,
): Promise<OwnedPerksResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const r = await setPerkOwned(userId, perkId, owned);
  if (r.ok) revalidatePath(PATH);
  return r;
}

export async function setManyOwnedPerksAction(
  perkIds: string[],
  owned: boolean,
): Promise<OwnedPerksResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const r = await setManyOwned(userId, perkIds, owned);
  if (r.ok) revalidatePath(PATH);
  return r;
}

export async function clearOwnedPerksAction(): Promise<OwnedPerksResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const r = await clearOwnedPerks(userId);
  if (r.ok) revalidatePath(PATH);
  return r;
}
