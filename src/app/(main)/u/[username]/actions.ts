"use server";

import { revalidatePath } from "next/cache";

import { adminClearProfile } from "@/lib/services/profile-public.service";

/** Admin-only: blank a user's bio/avatar and clear their picks. Self-guards. */
export async function clearProfileAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  const username = String(formData.get("username") ?? "");
  if (userId) await adminClearProfile(userId);
  if (username) revalidatePath(`/u/${username}`);
}
