"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import {
  applyImportFromText,
  previewImportFromText,
  type ApplyMode,
  type ImportPreview,
  type ImportResult,
} from "@/lib/services/backup.service";

/**
 * A2 — dry-run preview of an uploaded backup. Read-only: validates and reports
 * what WOULD change. Staff-guarded. Never writes.
 */
export async function previewBackupAction(
  text: string,
): Promise<ImportPreview> {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) {
    return { ok: false, error: "Staff only." };
  }
  if (typeof text !== "string" || text.length === 0) {
    return { ok: false, error: "No file contents received." };
  }
  if (text.length > 20_000_000) {
    return { ok: false, error: "That file is too large." };
  }
  return previewImportFromText(text);
}

/**
 * A3 — APPLY an uploaded backup. Non-destructive upsert (merge / overwrite).
 * Staff-guarded. The only write path; revalidates surfaces that read settings.
 */
export async function applyBackupAction(
  text: string,
  mode: ApplyMode,
): Promise<ImportResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) {
    return { ok: false, error: "Staff only." };
  }
  if (typeof text !== "string" || text.length === 0) {
    return { ok: false, error: "No file contents received." };
  }
  if (text.length > 20_000_000) {
    return { ok: false, error: "That file is too large." };
  }
  if (mode !== "merge" && mode !== "overwrite") {
    return { ok: false, error: "Invalid mode." };
  }
  const result = await applyImportFromText(text, mode);
  if (result.ok) {
    revalidatePath("/", "layout");
    revalidatePath("/admin/backup");
  }
  return result;
}
