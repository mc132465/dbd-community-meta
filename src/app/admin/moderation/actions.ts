"use server";

import { revalidatePath } from "next/cache";

import {
  resolveReport,
  type ModResult,
} from "@/lib/services/discussion-moderation.service";

/**
 * Mark a discussion report as resolved (staff-only; enforced in the service).
 * Reused by the moderation queue.
 */
export async function resolveReportAction(
  reportId: string,
): Promise<ModResult> {
  const r = await resolveReport(reportId);
  if (r.ok) revalidatePath("/admin/moderation");
  return r;
}
