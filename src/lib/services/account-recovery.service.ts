import "server-only";

import { db } from "@/lib/db/kysely";
import { hashPassword } from "@/lib/auth/password";
import { clearSessionCookie } from "@/lib/auth/session";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { createEmailToken, consumeEmailToken } from "@/lib/email/tokens";
import {
  sendDeleteConfirmEmail,
  sendPasswordResetEmail,
  sendRestoreEmail,
} from "@/lib/email/send";

export type RecoveryResult = { ok: true } | { ok: false; error: string };

async function clearUserSessions(userId: string): Promise<void> {
  await db.deleteFrom("sessions").where("user_id", "=", userId).execute();
}

// ---------- Password reset ----------

/** Always returns ok (never reveals whether the email exists). */
export async function requestPasswordReset(email: string): Promise<RecoveryResult> {
  const user = await db
    .selectFrom("users")
    .select(["id", "email"])
    .where("email", "=", email.toLowerCase())
    .where("anonymized_at", "is", null)
    .executeTakeFirst();
  if (user?.email) {
    const raw = await createEmailToken(user.id, "password_reset");
    await sendPasswordResetEmail(user.email, raw);
  }
  return { ok: true };
}

export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<RecoveryResult> {
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  const userId = await consumeEmailToken(rawToken, "password_reset");
  if (!userId) {
    return { ok: false, error: "This reset link is invalid or has expired." };
  }
  const password_hash = await hashPassword(newPassword);
  await db
    .updateTable("users")
    .set({ password_hash, updated_at: new Date().toISOString() })
    .where("id", "=", userId)
    .execute();
  await clearUserSessions(userId);
  return { ok: true };
}

// ---------- Account restoration ----------

/** Send a restore link for an archived (not anonymized) account. Always ok. */
export async function requestRestore(email: string): Promise<RecoveryResult> {
  const user = await db
    .selectFrom("users")
    .select(["id", "email", "deleted_at", "anonymized_at"])
    .where("email", "=", email.toLowerCase())
    .executeTakeFirst();
  if (user?.email && user.deleted_at !== null && user.anonymized_at === null) {
    const raw = await createEmailToken(user.id, "restore");
    await sendRestoreEmail(user.email, raw);
  }
  return { ok: true };
}

export async function restoreAccount(rawToken: string): Promise<RecoveryResult> {
  const userId = await consumeEmailToken(rawToken, "restore");
  if (!userId) {
    return { ok: false, error: "This restore link is invalid or has expired." };
  }
  const user = await db
    .selectFrom("users")
    .select(["anonymized_at"])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!user || user.anonymized_at !== null) {
    return { ok: false, error: "This account can no longer be restored." };
  }
  await db
    .updateTable("users")
    .set({ deleted_at: null, status: "active", updated_at: new Date().toISOString() })
    .where("id", "=", userId)
    .execute();
  return { ok: true };
}

// ---------- Self-service deletion ----------

/** Logged-in user requests deletion; emails a confirmation link. */
export async function requestSelfDeletion(): Promise<RecoveryResult> {
  const me = await getCurrentProfile();
  if (!me) return { ok: false, error: "Not signed in." };
  const row = await db
    .selectFrom("users")
    .select(["email"])
    .where("id", "=", me.id)
    .executeTakeFirst();
  if (!row?.email) {
    return { ok: false, error: "Add and verify an email before deleting your account." };
  }
  const raw = await createEmailToken(me.id, "delete_confirm");
  await sendDeleteConfirmEmail(row.email, raw);
  return { ok: true };
}

/** Consume a delete-confirm token → archive the account + end sessions. */
export async function confirmSelfDeletion(rawToken: string): Promise<RecoveryResult> {
  const userId = await consumeEmailToken(rawToken, "delete_confirm");
  if (!userId) {
    return { ok: false, error: "This confirmation link is invalid or has expired." };
  }
  await db
    .updateTable("users")
    .set({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .where("id", "=", userId)
    .execute();
  await clearUserSessions(userId);
  clearSessionCookie();
  return { ok: true };
}
