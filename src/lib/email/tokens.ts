import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { db } from "@/lib/db/kysely";

export type TokenPurpose = "verify" | "password_reset" | "delete_confirm" | "restore";

const TTL_MS: Record<TokenPurpose, number> = {
  verify: 1000 * 60 * 60 * 24 * 3, // 3 days
  password_reset: 1000 * 60 * 60, // 1 hour
  delete_confirm: 1000 * 60 * 60, // 1 hour
  restore: 1000 * 60 * 60 * 24 * 7, // 7 days
};

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Create a single-use token; returns the raw token (store only the hash). */
export async function createEmailToken(
  userId: string,
  purpose: TokenPurpose,
): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await db
    .insertInto("email_tokens")
    .values({
      user_id: userId,
      purpose,
      token_hash: hashToken(raw),
      expires_at: new Date(Date.now() + TTL_MS[purpose]).toISOString(),
    })
    .execute();
  return raw;
}

/** Validate + consume a token. Returns the user id, or null if invalid/expired/used. */
export async function consumeEmailToken(
  raw: string,
  purpose: TokenPurpose,
): Promise<string | null> {
  if (!raw) return null;
  const row = await db
    .selectFrom("email_tokens")
    .select(["id", "user_id", "expires_at", "used_at"])
    .where("token_hash", "=", hashToken(raw))
    .where("purpose", "=", purpose)
    .executeTakeFirst();
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }
  await db
    .updateTable("email_tokens")
    .set({ used_at: new Date().toISOString() })
    .where("id", "=", row.id)
    .execute();
  return row.user_id;
}
