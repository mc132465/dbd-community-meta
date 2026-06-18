"use server";

import { revalidatePath } from "next/cache";

import {
  setArchived,
  hardDelete,
  type ModType,
} from "@/lib/services/moderation-content.service";

const TYPES: ModType[] = ["builds", "comments", "tier_lists", "discussions"];

function parseType(v: FormDataEntryValue | null): ModType {
  const s = String(v ?? "");
  return (TYPES as string[]).includes(s) ? (s as ModType) : "builds";
}

export async function archiveAction(formData: FormData): Promise<void> {
  const type = parseType(formData.get("type"));
  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  if (id) await setArchived(type, id, archived);
  revalidatePath("/admin/moderation/content");
}

export async function hardDeleteAction(formData: FormData): Promise<void> {
  const type = parseType(formData.get("type"));
  const id = String(formData.get("id") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  // Permanent deletion requires the admin to type DELETE.
  if (id && confirm === "DELETE") await hardDelete(type, id);
  revalidatePath("/admin/moderation/content");
}
