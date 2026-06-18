import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { db } from "@/lib/db/kysely";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/cookie";

/**
 * Sessions are opaque random tokens. The raw token lives only in the httpOnly
 * cookie; the database stores its SHA-256 hash, so a DB leak can't be replayed
 * as a login.
 */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await db
    .insertInto("sessions")
    .values({
      user_id: userId,
      token_hash: hashToken(token),
      expires_at: expiresAt.toISOString(),
    })
    .execute();
  // Record activity on login (basis for the "last active" column + later
  // inactivity cleanup). Best-effort: never block login on this.
  try {
    await db
      .updateTable("users")
      .set({ last_active_at: new Date().toISOString() })
      .where("id", "=", userId)
      .execute();
  } catch {
    /* ignore */
  }
  return { token, expiresAt };
}

export async function getUserIdFromToken(raw: string): Promise<string | null> {
  const row = await db
    .selectFrom("sessions")
    .innerJoin("users", "users.id", "sessions.user_id")
    .select([
      "sessions.user_id as user_id",
      "sessions.expires_at as expires_at",
      "users.status as status",
      "users.deleted_at as deleted_at",
    ])
    .where("sessions.token_hash", "=", hashToken(raw))
    .executeTakeFirst();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  // Suspended/banned or archived (soft-deleted) users are treated as logged
  // out everywhere — every auth path resolves through this function.
  if (row.status !== "active" || row.deleted_at !== null) return null;
  return row.user_id;
}

export async function deleteSessionByToken(raw: string): Promise<void> {
  await db.deleteFrom("sessions").where("token_hash", "=", hashToken(raw)).execute();
}

// ---------- Cookie helpers (call only from server actions / route handlers) ----------
// Only mark the cookie `Secure` when explicitly enabled. Browsers DROP `Secure`
// cookies over plain HTTP, which would break login on http://SERVER_IP:3000.
// Set SESSION_COOKIE_SECURE=true only when serving over HTTPS (TLS / reverse proxy).
const SECURE_COOKIE = process.env.SESSION_COOKIE_SECURE === "true";

export function setSessionCookie(token: string, expiresAt: Date): void {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE);
}

/** Read the raw session token from the request cookies (safe in components). */
export function readSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}
