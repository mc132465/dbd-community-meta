import "server-only";

import { sql } from "kysely";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import { reportReasonSchema } from "@/lib/validations/discussion";
import type { DiscussionStatus } from "@/types/database";

/**
 * Moderation for discussions. Lock/unlock/archive/restore/delete require
 * moderator or admin. Reporting requires any logged-in user. No notifications.
 */

export type ModResult = { ok: true } | { ok: false; error: string };

async function requireStaffId(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) {
    return { ok: false, error: "Not authorized." };
  }
  return { ok: true, id: profile.id };
}

async function setThreadStatus(
  threadId: string,
  status: DiscussionStatus,
): Promise<ModResult> {
  const auth = await requireStaffId();
  if (!auth.ok) return auth;
  try {
    await db
      .updateTable("discussion_threads")
      .set({ status, updated_at: new Date().toISOString() })
      .where("id", "=", threadId)
      .where("deleted_at", "is", null)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

export function lockThread(threadId: string): Promise<ModResult> {
  return setThreadStatus(threadId, "locked");
}

export function unlockThread(threadId: string): Promise<ModResult> {
  return setThreadStatus(threadId, "open");
}

export function archiveThread(threadId: string): Promise<ModResult> {
  return setThreadStatus(threadId, "archived");
}

/** Restore an archived/locked thread back to open. */
export function restoreThread(threadId: string): Promise<ModResult> {
  return setThreadStatus(threadId, "open");
}

export async function deleteThreadAsModerator(
  threadId: string,
): Promise<ModResult> {
  const auth = await requireStaffId();
  if (!auth.ok) return auth;
  try {
    await db
      .updateTable("discussion_threads")
      .set({ deleted_at: new Date().toISOString(), deleted_by: auth.id })
      .where("id", "=", threadId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

export async function deleteReplyAsModerator(
  replyId: string,
): Promise<ModResult> {
  const auth = await requireStaffId();
  if (!auth.ok) return auth;
  try {
    const reply = await db
      .selectFrom("discussion_replies")
      .select(["thread_id", "deleted_at"])
      .where("id", "=", replyId)
      .executeTakeFirst();
    if (!reply || reply.deleted_at) return { ok: false, error: "Reply not found." };

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("discussion_replies")
        .set({ deleted_at: new Date().toISOString(), deleted_by: auth.id })
        .where("id", "=", replyId)
        .execute();
      await trx
        .updateTable("discussion_threads")
        .set({ reply_count: sql`greatest(reply_count - 1, 0)` })
        .where("id", "=", reply.thread_id)
        .execute();
    });
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/** Restore a moderator-hidden (soft-deleted) thread back to public view. */
export async function restoreDeletedThread(
  threadId: string,
): Promise<ModResult> {
  const auth = await requireStaffId();
  if (!auth.ok) return auth;
  try {
    await db
      .updateTable("discussion_threads")
      .set({
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", threadId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/** Restore a moderator-hidden (soft-deleted) reply and re-bump reply_count. */
export async function restoreDeletedReply(
  replyId: string,
): Promise<ModResult> {
  const auth = await requireStaffId();
  if (!auth.ok) return auth;
  try {
    const reply = await db
      .selectFrom("discussion_replies")
      .select(["thread_id", "deleted_at"])
      .where("id", "=", replyId)
      .executeTakeFirst();
    if (!reply) return { ok: false, error: "Reply not found." };
    if (!reply.deleted_at) return { ok: true }; // already visible

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("discussion_replies")
        .set({
          deleted_at: null,
          deleted_by: null,
          updated_at: new Date().toISOString(),
        })
        .where("id", "=", replyId)
        .execute();
      await trx
        .updateTable("discussion_threads")
        .set({ reply_count: sql`reply_count + 1` })
        .where("id", "=", reply.thread_id)
        .execute();
    });
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

// ---------- reports ----------

async function createReport(
  targetType: "thread" | "reply",
  targetId: string,
  reason: unknown,
): Promise<ModResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sign in to report." };

  const parsed = reportReasonSchema.safeParse({ reason });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Add a reason.",
    };
  }
  try {
    await db
      .insertInto("discussion_reports")
      .values({
        target_type: targetType,
        target_id: targetId,
        reporter_id: profile.id,
        reason: parsed.data.reason,
      })
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

export function reportThread(
  threadId: string,
  reason: unknown,
): Promise<ModResult> {
  return createReport("thread", threadId, reason);
}

export function reportReply(replyId: string, reason: unknown): Promise<ModResult> {
  return createReport("reply", replyId, reason);
}

export type OpenReport = {
  id: string;
  targetType: string;
  targetId: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  createdAt: string;
};

export async function listOpenReports(): Promise<OpenReport[]> {
  const auth = await requireStaffId();
  if (!auth.ok) return [];
  const rows = await db
    .selectFrom("discussion_reports")
    .leftJoin("profiles", "profiles.id", "discussion_reports.reporter_id")
    .select((eb) => [
      "discussion_reports.id as id",
      "discussion_reports.target_type as target_type",
      "discussion_reports.target_id as target_id",
      "discussion_reports.reporter_id as reporter_id",
      "discussion_reports.reason as reason",
      "discussion_reports.created_at as created_at",
      eb.ref("profiles.username").as("reporter_name"),
    ])
    .where("discussion_reports.resolved_at", "is", null)
    .orderBy("discussion_reports.created_at", "desc")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    targetType: r.target_type,
    targetId: r.target_id,
    reporterId: r.reporter_id,
    reporterName: (r.reporter_name as string) ?? "unknown",
    reason: r.reason,
    createdAt: r.created_at,
  }));
}

export async function resolveReport(reportId: string): Promise<ModResult> {
  const auth = await requireStaffId();
  if (!auth.ok) return auth;
  try {
    await db
      .updateTable("discussion_reports")
      .set({ resolved_at: new Date().toISOString(), resolved_by: auth.id })
      .where("id", "=", reportId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

// ---------- reports queue (read enrichment; no schema change) ----------

export type ReportContext =
  | {
      kind: "thread";
      threadId: string;
      slug: string;
      title: string;
      status: DiscussionStatus;
      hidden: boolean;
    }
  | {
      kind: "reply";
      replyId: string;
      threadId: string;
      slug: string;
      title: string;
      status: DiscussionStatus;
      excerpt: string;
      hidden: boolean;
    }
  | { kind: "missing" };

export type ReportWithContext = OpenReport & { context: ReportContext };

/**
 * Open reports enriched with their target context (thread slug/title/status, or
 * reply excerpt + parent thread). Reuses listOpenReports() then batch-loads the
 * referenced threads/replies. A target that no longer exists → kind "missing".
 */
export async function listOpenReportsWithContext(): Promise<ReportWithContext[]> {
  const reports = await listOpenReports();
  if (reports.length === 0) return [];

  const replyTargetIds = reports
    .filter((r) => r.targetType === "reply")
    .map((r) => r.targetId);
  const threadTargetIds = reports
    .filter((r) => r.targetType === "thread")
    .map((r) => r.targetId);

  const replyRows = replyTargetIds.length
    ? await db
        .selectFrom("discussion_replies")
        .select(["id", "thread_id", "body", "deleted_at"])
        .where("id", "in", replyTargetIds)
        .execute()
    : [];
  const replyById = new Map(replyRows.map((r) => [r.id, r]));

  const allThreadIds = Array.from(
    new Set([...threadTargetIds, ...replyRows.map((r) => r.thread_id)]),
  );
  const threadRows = allThreadIds.length
    ? await db
        .selectFrom("discussion_threads")
        .select(["id", "slug", "title", "status", "deleted_at"])
        .where("id", "in", allThreadIds)
        .execute()
    : [];
  const threadById = new Map(threadRows.map((t) => [t.id, t]));

  const missing: ReportContext = { kind: "missing" };

  return reports.map((r): ReportWithContext => {
    if (r.targetType === "thread") {
      const t = threadById.get(r.targetId);
      if (!t) return { ...r, context: missing };
      return {
        ...r,
        context: {
          kind: "thread",
          threadId: t.id,
          slug: t.slug,
          title: t.title,
          status: t.status,
          hidden: Boolean(t.deleted_at),
        },
      };
    }
    if (r.targetType === "reply") {
      const rep = replyById.get(r.targetId);
      const t = rep ? threadById.get(rep.thread_id) : undefined;
      if (!rep || !t) return { ...r, context: missing };
      const excerpt =
        rep.body.length > 200 ? `${rep.body.slice(0, 200)}…` : rep.body;
      return {
        ...r,
        context: {
          kind: "reply",
          replyId: rep.id,
          threadId: t.id,
          slug: t.slug,
          title: t.title,
          status: t.status,
          excerpt,
          hidden: Boolean(rep.deleted_at),
        },
      };
    }
    return { ...r, context: missing };
  });
}

/** Count of unresolved reports (for the admin nav badge). */
export async function countOpenReports(): Promise<number> {
  const auth = await requireStaffId();
  if (!auth.ok) return 0;
  const row = await db
    .selectFrom("discussion_reports")
    .select((eb) => eb.fn.countAll<number>().as("c"))
    .where("resolved_at", "is", null)
    .executeTakeFirst();
  return Number(row?.c ?? 0);
}
