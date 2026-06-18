import "server-only";

import { db } from "@/lib/db/kysely";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isAdmin } from "@/lib/auth/roles";
import {
  clearSessionCookie,
  createSession,
  deleteSessionByToken,
  getUserIdFromToken,
  readSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { normalizeUsername } from "@/lib/auth/username";
import { createEmailToken } from "@/lib/email/tokens";
import { sendVerificationEmail } from "@/lib/email/send";
import type {
  ChangeUsernameInput,
  SignInInput,
  SignUpInput,
} from "@/lib/validations/auth";

export type AuthResult = { ok: true } | { ok: false; error: string };

const USERNAME_COOLDOWN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "23505";
}

/**
 * Create an account from username + password (local auth).
 * users holds the argon2id hash; profiles holds the public identity. Both are
 * inserted in one transaction, then a session cookie is set.
 */
export async function signUpWithUsername(
  input: SignUpInput,
): Promise<AuthResult> {
  const username = normalizeUsername(input.username);

  const existing = await db
    .selectFrom("profiles")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();
  if (existing) return { ok: false, error: "That username is already taken." };

  const emailTaken = await db
    .selectFrom("users")
    .select("id")
    .where("email", "=", input.email)
    .executeTakeFirst();
  if (emailTaken) return { ok: false, error: "That email is already in use." };

  const password_hash = await hashPassword(input.password);

  let userId: string;
  try {
    userId = await db.transaction().execute(async (trx) => {
      const user = await trx
        .insertInto("users")
        .values({ password_hash, email: input.email })
        .returning("id")
        .executeTakeFirstOrThrow();
      await trx
        .insertInto("profiles")
        .values({
          id: user.id,
          username,
          role: "user",
          display_name: null,
          avatar_url: null,
          bio: null,
          last_username_change_at: null,
        })
        .execute();
      return user.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "That username or email is already in use." };
    }
    return { ok: false, error: "Could not create your account. Try again." };
  }

  // Send the verification email (non-fatal — the account is already created).
  try {
    const raw = await createEmailToken(userId, "verify");
    await sendVerificationEmail(input.email, raw);
  } catch {
    /* best-effort; user can resend from account settings */
  }

  const { token, expiresAt } = await createSession(userId);
  setSessionCookie(token, expiresAt);
  return { ok: true };
}

/** Sign in by username OR email + password; sets a session cookie on success. */
export async function signInWithUsername(
  input: SignInInput,
): Promise<AuthResult> {
  const identifier = input.identifier.trim();
  const isEmail = identifier.includes("@");

  let query = db
    .selectFrom("profiles")
    .innerJoin("users", "users.id", "profiles.id")
    .select([
      "profiles.id as id",
      "users.password_hash as password_hash",
      "users.status as status",
      "users.deleted_at as deleted_at",
    ]);
  query = isEmail
    ? query.where("users.email", "=", identifier.toLowerCase())
    : query.where("profiles.username", "=", normalizeUsername(identifier));
  const row = await query.executeTakeFirst();

  // Keep the message generic whether or not the account exists.
  if (!row) return { ok: false, error: "Incorrect username or password." };

  const valid = await verifyPassword(row.password_hash, input.password);
  if (!valid) return { ok: false, error: "Incorrect username or password." };

  // Suspended, banned, or archived accounts cannot sign in.
  if (row.deleted_at !== null) {
    return { ok: false, error: "This account is no longer active." };
  }
  if (row.status === "banned") {
    return { ok: false, error: "This account has been banned." };
  }
  if (row.status === "suspended") {
    return { ok: false, error: "This account is suspended." };
  }

  const { token, expiresAt } = await createSession(row.id);
  setSessionCookie(token, expiresAt);
  return { ok: true };
}

/** Destroy the current session and clear the cookie. */
export async function signOut(): Promise<void> {
  const token = readSessionToken();
  if (token) await deleteSessionByToken(token);
  clearSessionCookie();
}

/**
 * Change the signed-in user's username, at most once every 30 days. The DB
 * trigger re-enforces the cooldown as defense-in-depth.
 */
export async function changeUsername(
  input: ChangeUsernameInput,
): Promise<AuthResult> {
  const token = readSessionToken();
  const userId = token ? await getUserIdFromToken(token) : null;
  if (!userId) return { ok: false, error: "You must be signed in." };

  const nextUsername = normalizeUsername(input.username);

  const profile = await db
    .selectFrom("profiles")
    .select(["username", "last_username_change_at", "role"])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!profile) return { ok: false, error: "Profile not found." };

  if (profile.username === nextUsername) {
    return { ok: false, error: "That is already your username." };
  }

  // Admins bypass the cooldown (admin accounts are not normal users). The DB
  // trigger applies the same exemption as defense-in-depth.
  if (!isAdmin(profile.role) && profile.last_username_change_at) {
    const elapsedDays =
      (Date.now() - new Date(profile.last_username_change_at).getTime()) / DAY_MS;
    if (elapsedDays < USERNAME_COOLDOWN_DAYS) {
      const remaining = Math.ceil(USERNAME_COOLDOWN_DAYS - elapsedDays);
      return {
        ok: false,
        error: `You can change your username again in ${remaining} day(s).`,
      };
    }
  }

  try {
    await db
      .updateTable("profiles")
      .set({ username: nextUsername })
      .where("id", "=", userId)
      .execute();
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "That username is already taken." };
    }
    if ((err as Error)?.message?.toLowerCase().includes("30 days")) {
      return {
        ok: false,
        error: "You can only change your username once every 30 days.",
      };
    }
    return { ok: false, error: "Could not change your username." };
  }

  return { ok: true };
}
