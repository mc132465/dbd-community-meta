"use server";

import { revalidatePath } from "next/cache";

import {
  hardDeleteUser,
  restoreUser,
  setUserStatus,
  softDeleteUser,
  tombstoneUser,
} from "@/lib/services/user-admin.service";
import type { UserStatus } from "@/types/database";

// Service functions self-guard (admin only); these are thin form wrappers.

export async function setUserStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as UserStatus;
  if (id && status) await setUserStatus(id, status);
  revalidatePath("/admin/users");
}

export async function archiveUserAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await softDeleteUser(id);
  revalidatePath("/admin/users");
}

export async function restoreUserAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await restoreUser(id);
  revalidatePath("/admin/users");
}

export async function tombstoneUserAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await tombstoneUser(id);
  revalidatePath("/admin/users");
}

export async function hardDeleteUserAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (id && confirm) await hardDeleteUser(id, confirm);
  revalidatePath("/admin/users");
}
