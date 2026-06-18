import "server-only";

import { sql } from "kysely";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";

/**
 * Append an audit entry. The actor is resolved from the current session, so
 * callers only pass the action + entity. Logging never throws — a failure here
 * must not break the underlying operation.
 */
export async function recordAudit(
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const me = await getCurrentProfile();
    await db
      .insertInto("audit_log")
      .values({
        actor_id: me?.id ?? null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata: sql`${JSON.stringify(metadata)}::jsonb`,
      })
      .execute();
  } catch {
    // Swallow: audit logging is best-effort.
  }
}

export type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function listAuditLog(
  opts: { action?: string; entityType?: string; limit?: number } = {},
): Promise<AuditItem[]> {
  let q = db
    .selectFrom("audit_log as a")
    .leftJoin("profiles as p", "p.id", "a.actor_id")
    .select([
      "a.id as id",
      "a.action as action",
      "a.entity_type as entityType",
      "a.entity_id as entityId",
      "a.metadata as metadata",
      "a.created_at as createdAt",
      "p.username as actorUsername",
      "p.display_name as actorDisplay",
    ]);
  if (opts.entityType) q = q.where("a.entity_type", "=", opts.entityType);
  if (opts.action) q = q.where("a.action", "=", opts.action);
  const rows = await q
    .orderBy("a.created_at", "desc")
    .limit(Math.min(Math.max(opts.limit ?? 100, 1), 500))
    .execute();

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    actorName: r.actorDisplay ?? r.actorUsername ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.createdAt,
  }));
}

/** Distinct entity types present in the log (for the admin filter). */
export async function listAuditEntityTypes(): Promise<string[]> {
  const rows = await db
    .selectFrom("audit_log")
    .select("entity_type")
    .distinct()
    .orderBy("entity_type")
    .execute();
  return rows.map((r) => r.entity_type);
}
