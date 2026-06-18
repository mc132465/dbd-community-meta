import "server-only";

import argon2 from "argon2";

/** Hash a password with argon2id. */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/** Verify a password against an argon2 hash. Returns false on any error. */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
