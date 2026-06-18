"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  approveRevision,
  rejectRevision,
} from "@/lib/services/build-revisions.service";
import { recordAudit } from "@/lib/services/audit.service";

export async function approveRevisionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "");
  if (id) {
    await approveRevision(id, note);
    await recordAudit("revision.approve", "build_revision", id, { note });
  }
  revalidatePath("/admin/builds/revisions");
  revalidatePath("/builds");
  redirect("/admin/builds/revisions");
}

export async function rejectRevisionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "");
  if (id) {
    await rejectRevision(id, note);
    await recordAudit("revision.reject", "build_revision", id, { note });
  }
  revalidatePath("/admin/builds/revisions");
  redirect("/admin/builds/revisions");
}
