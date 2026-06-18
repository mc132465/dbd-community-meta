import "server-only";

import { randomUUID } from "node:crypto";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { recordAudit } from "@/lib/services/audit.service";
import { isAdmin, type UserRole } from "@/lib/auth/roles";
import type { UserStatus } from "@/types/database";

/**
 * User management (admin only). Soft-delete/archive, suspend/ban, and restore —
 * never a hard delete. Suspended/banned/archived users are logged out at the
 * auth choke point (getUserIdFromToken); these mutations also clear their
 * sessions for an immediate effect. Admins cannot lock out their own account.
 */

export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastActiveAt: string | null;
  deletedAt: string | null;
  anonymizedAt: string | null;
};

export type UserAdminResult = { ok: true } | { ok: false; error: string };

const STATUSES: UserStatus[] = ["active", "suspended", "banned"];

async function requireAdmin(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile.role)) {
    return { ok: false, error: "Admin only." };
  }
  return { ok: true, id: profile.id };
}

async function clearUserSessions(userId: string): Promise<void> {
  try {
    await db.deleteFrom("sessions").where("user_id", "=", userId).execute();
  } catch {
    /* best-effort */
  }
}

/** All users with their profile, newest first (admin list). */
export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  const rows = await db
    .selectFrom("users")
    .innerJoin("profiles", "profiles.id", "users.id")
    .select([
      "users.id as id",
      "profiles.username as username",
      "profiles.display_name as displayName",
      "profiles.role as role",
      "users.status as status",
      "users.created_at as createdAt",
      "users.last_active_at as lastActiveAt",
      "users.deleted_at as deletedAt",
      "users.anonymized_at as anonymizedAt",
    ])
    .orderBy("users.created_at", "desc")
    .execute();
  return rows as AdminUserRow[];
}

/** Set a user's status (active / suspended / banned). Admin only. */
export async function setUserStatus(
  userId: string,
  status: UserStatus,
): Promise<UserAdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
  if (userId === auth.id) {
    return { ok: false, error: "You can't change your own status." };
  }
  try {
    await db
      .updateTable("users")
      .set({ status, updated_at: new Date().toISOString() })
      .where("id", "=", userId)
      .execute();
    if (status !== "active") await clearUserSessions(userId);
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/** Soft-delete / archive a user (reversible). Admin only. */
export async function softDeleteUser(userId: string): Promise<UserAdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (userId === auth.id) {
    return { ok: false, error: "You can't archive your own account here." };
  }
  try {
    await db
      .updateTable("users")
      .set({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .where("id", "=", userId)
      .where("deleted_at", "is", null)
      .execute();
    await clearUserSessions(userId);
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/** Restore an archived user (clears deleted_at). Admin only. */
export async function restoreUser(userId: string): Promise<UserAdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  try {
    await db
      .updateTable("users")
      .set({ deleted_at: null, updated_at: new Date().toISOString() })
      .where("id", "=", userId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/**
 * Tombstone / anonymize a user (DEFAULT, safe). Keeps the row + all authored
 * content; blanks PII, frees the username (renamed to `deleted_<id8>`), and marks
 * the account anonymized + archived. Reachable from the archived state. Admin only.
 */
export async function tombstoneUser(userId: string): Promise<UserAdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (userId === auth.id) {
    return { ok: false, error: "You can't delete your own account here." };
  }
  try {
    const profile = await db
      .selectFrom("profiles")
      .select(["username"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!profile) return { ok: false, error: "User not found." };

    const freedName = `deleted_${userId.replace(/-/g, "").slice(0, 8)}`;
    const now = new Date().toISOString();
    const disabledHash = `disabled:${randomUUID()}${randomUUID()}`;

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("profiles")
        .set({
          username: freedName,
          display_name: "[deleted]",
          avatar_url: null,
          bio: null,
          is_public: false,
          updated_at: now,
        })
        .where("id", "=", userId)
        .execute();
      await trx
        .updateTable("users")
        .set({
          password_hash: disabledHash,
          deleted_at: now,
          anonymized_at: now,
          updated_at: now,
        })
        .where("id", "=", userId)
        .execute();
      await trx.deleteFrom("sessions").where("user_id", "=", userId).execute();
    });

    await recordAudit("user.anonymize", "user", userId, {
      previousUsername: profile.username,
    });
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/**
 * Hard delete (ADMIN-ONLY, destructive). Permanently removes the user row, which
 * cascades to the profile, sessions, and all authored content. Requires the typed
 * username to match. The audit entry is written BEFORE the delete. Admin only.
 */
export async function hardDeleteUser(
  userId: string,
  confirmUsername: string,
): Promise<UserAdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (userId === auth.id) {
    return { ok: false, error: "You can't hard-delete your own account." };
  }
  try {
    const profile = await db
      .selectFrom("profiles")
      .select(["username"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!profile) return { ok: false, error: "User not found." };
    if ((confirmUsername ?? "").trim() !== profile.username) {
      return { ok: false, error: "Typed username does not match." };
    }

    // Record first — the row (and its audit linkage) is about to disappear.
    await recordAudit("user.hard_delete", "user", userId, {
      username: profile.username,
    });
    await db.deleteFrom("users").where("id", "=", userId).execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}
