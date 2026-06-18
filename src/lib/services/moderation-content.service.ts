import "server-only";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isAdmin } from "@/lib/auth/roles";
import { recordAudit } from "@/lib/services/audit.service";

export type ModType = "builds" | "comments" | "tier_lists" | "discussions";
export type ModResult = { ok: true } | { ok: false; error: string };

export type ModItem = {
  id: string;
  title: string;
  subtitle: string | null;
  href: string | null;
  archived: boolean;
  createdAt: string;
};

const nowIso = () => new Date().toISOString();

async function requireAdmin() {
  const me = await getCurrentProfile();
  if (!me || !isAdmin(me.role)) return null;
  return me;
}

function authorName(displayName: string | null, username: string | null): string {
  return displayName ?? username ?? "[deleted]";
}

// ---------- listing ----------

export async function listForModeration(
  type: ModType,
  q = "",
  limit = 100,
): Promise<ModItem[]> {
  const needle = q.trim().toLowerCase();
  const like = `%${needle.replace(/[%_]/g, "")}%`;

  if (type === "builds") {
    let qb = db
      .selectFrom("builds as b")
      .leftJoin("profiles as p", "p.id", "b.author_id")
      .select([
        "b.id as id",
        "b.title as title",
        "b.slug as slug",
        "b.status as status",
        "b.deleted_at as deletedAt",
        "b.created_at as createdAt",
        "p.display_name as displayName",
        "p.username as username",
      ])
      .orderBy("b.created_at", "desc")
      .limit(limit);
    if (needle) qb = qb.where("b.title", "ilike", like);
    const rows = await qb.execute();
    return rows.map((r) => ({
      id: r.id,
      title: r.title ?? "Untitled build",
      subtitle: `${authorName(r.displayName, r.username)} · ${r.status}`,
      href: `/builds/${r.slug}`,
      archived: r.deletedAt !== null,
      createdAt: r.createdAt,
    }));
  }

  if (type === "comments") {
    let qb = db
      .selectFrom("build_comments as c")
      .innerJoin("builds as b", "b.id", "c.build_id")
      .leftJoin("profiles as p", "p.id", "c.author_id")
      .select([
        "c.id as id",
        "c.body as body",
        "c.deleted_at as deletedAt",
        "c.created_at as createdAt",
        "b.slug as buildSlug",
        "b.title as buildTitle",
        "p.display_name as displayName",
        "p.username as username",
      ])
      .orderBy("c.created_at", "desc")
      .limit(limit);
    if (needle) qb = qb.where("c.body", "ilike", like);
    const rows = await qb.execute();
    return rows.map((r) => ({
      id: r.id,
      title: r.body.length > 90 ? `${r.body.slice(0, 90)}…` : r.body,
      subtitle: `${authorName(r.displayName, r.username)} · on ${r.buildTitle ?? "build"}`,
      href: `/builds/${r.buildSlug}`,
      archived: r.deletedAt !== null,
      createdAt: r.createdAt,
    }));
  }

  if (type === "tier_lists") {
    let qb = db
      .selectFrom("tier_lists as t")
      .leftJoin("profiles as p", "p.id", "t.author_id")
      .select([
        "t.id as id",
        "t.title as title",
        "t.slug as slug",
        "t.status as status",
        "t.created_at as createdAt",
        "p.display_name as displayName",
        "p.username as username",
      ])
      .orderBy("t.created_at", "desc")
      .limit(limit);
    if (needle) qb = qb.where("t.title", "ilike", like);
    const rows = await qb.execute();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: `${authorName(r.displayName, r.username)} · ${r.status}`,
      href: `/tier-lists/${r.slug}`,
      archived: r.status === "archived",
      createdAt: r.createdAt,
    }));
  }

  // discussions
  let qb = db
    .selectFrom("discussion_threads as t")
    .leftJoin("profiles as p", "p.id", "t.author_id")
    .select([
      "t.id as id",
      "t.title as title",
      "t.slug as slug",
      "t.status as status",
      "t.deleted_at as deletedAt",
      "t.created_at as createdAt",
      "p.display_name as displayName",
      "p.username as username",
    ])
    .orderBy("t.created_at", "desc")
    .limit(limit);
  if (needle) qb = qb.where("t.title", "ilike", like);
  const rows = await qb.execute();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: `${authorName(r.displayName, r.username)} · ${r.status}`,
    href: `/discussions/${r.slug}`,
    archived: r.deletedAt !== null,
    createdAt: r.createdAt,
  }));
}

// ---------- archive / restore (soft) ----------

export async function setArchived(
  type: ModType,
  id: string,
  archived: boolean,
): Promise<ModResult> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Admin only." };
  try {
    if (type === "tier_lists") {
      await db
        .updateTable("tier_lists")
        .set({ status: archived ? "archived" : "published" })
        .where("id", "=", id)
        .execute();
    } else if (type === "builds") {
      await db
        .updateTable("builds")
        .set({ deleted_at: archived ? nowIso() : null })
        .where("id", "=", id)
        .execute();
    } else if (type === "comments") {
      await db
        .updateTable("build_comments")
        .set({ deleted_at: archived ? nowIso() : null })
        .where("id", "=", id)
        .execute();
    } else {
      await db
        .updateTable("discussion_threads")
        .set({ deleted_at: archived ? nowIso() : null })
        .where("id", "=", id)
        .execute();
    }
    await recordAudit(archived ? "content.archive" : "content.restore", type, id, {});
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Failed." };
  }
}

// ---------- permanent delete (hard, admin-only, audit-first) ----------

export async function hardDelete(type: ModType, id: string): Promise<ModResult> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Admin only." };
  try {
    // Audit BEFORE deletion so the record survives the cascade.
    await recordAudit(`${type}.hard_delete`, type, id, {});
    if (type === "builds") {
      await db.deleteFrom("builds").where("id", "=", id).execute();
    } else if (type === "comments") {
      await db.deleteFrom("build_comments").where("id", "=", id).execute();
    } else if (type === "tier_lists") {
      await db.deleteFrom("tier_lists").where("id", "=", id).execute();
    } else {
      await db.deleteFrom("discussion_threads").where("id", "=", id).execute();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Failed." };
  }
}
