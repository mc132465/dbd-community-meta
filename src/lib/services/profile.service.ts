import "server-only";

import { db } from "@/lib/db/kysely";
import { getUserIdFromToken, readSessionToken } from "@/lib/auth/session";
import type { ProfileRow } from "@/types/database";

/**
 * The profile for the currently authenticated user, or null. Resolves the
 * session cookie → session row → profile. Components and actions call services
 * like this rather than touching the DB client directly.
 */
export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const token = readSessionToken();
  if (!token) return null;
  const userId = await getUserIdFromToken(token);
  if (!userId) return null;

  const row = await db
    .selectFrom("profiles")
    .selectAll()
    .where("id", "=", userId)
    .executeTakeFirst();
  return (row as ProfileRow | undefined) ?? null;
}

export async function getProfileByUsername(
  username: string,
): Promise<ProfileRow | null> {
  const row = await db
    .selectFrom("profiles")
    .selectAll()
    .where("username", "=", username.toLowerCase())
    .executeTakeFirst();
  return (row as ProfileRow | undefined) ?? null;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const row = await db
    .selectFrom("profiles")
    .select("id")
    .where("username", "=", username.toLowerCase())
    .executeTakeFirst();
  return Boolean(row);
}
