import "server-only";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { createEmailToken, consumeEmailToken } from "@/lib/email/tokens";
import { sendVerificationEmail } from "@/lib/email/send";

export type EmailResult = { ok: true } | { ok: false; error: string };

/** Consume a verify token and mark the user's email verified. */
export async function verifyEmail(raw: string): Promise<EmailResult> {
  const userId = await consumeEmailToken(raw, "verify");
  if (!userId) {
    return { ok: false, error: "This verification link is invalid or has expired." };
  }
  await db
    .updateTable("users")
    .set({ email_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .where("id", "=", userId)
    .execute();
  return { ok: true };
}

export type EmailStatus = {
  email: string | null;
  verified: boolean;
  newsletter: boolean;
  events: boolean;
  status: string;
};

/** Current user's email + verification + opt-in state (for settings + nag). */
export async function getMyEmailStatus(): Promise<EmailStatus | null> {
  const me = await getCurrentProfile();
  if (!me) return null;
  const row = await db
    .selectFrom("users")
    .select(["email", "email_verified_at", "status"])
    .where("id", "=", me.id)
    .executeTakeFirst();
  if (!row) return null;
  return {
    email: row.email ?? null,
    verified: row.email_verified_at !== null,
    newsletter: me.email_opt_newsletter,
    events: me.email_opt_events,
    status: row.status,
  };
}

/** Set/change the signed-in user's email (resets verification + sends a new link). */
export async function setMyEmail(email: string): Promise<EmailResult> {
  const me = await getCurrentProfile();
  if (!me) return { ok: false, error: "Not signed in." };
  const taken = await db
    .selectFrom("users")
    .select("id")
    .where("email", "=", email)
    .where("id", "!=", me.id)
    .executeTakeFirst();
  if (taken) return { ok: false, error: "That email is already in use." };
  try {
    await db
      .updateTable("users")
      .set({ email, email_verified_at: null, updated_at: new Date().toISOString() })
      .where("id", "=", me.id)
      .execute();
    const raw = await createEmailToken(me.id, "verify");
    await sendVerificationEmail(email, raw);
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/** Resend the verification email to the user's current address. */
export async function resendVerification(): Promise<EmailResult> {
  const me = await getCurrentProfile();
  if (!me) return { ok: false, error: "Not signed in." };
  const row = await db
    .selectFrom("users")
    .select(["email", "email_verified_at"])
    .where("id", "=", me.id)
    .executeTakeFirst();
  if (!row?.email) return { ok: false, error: "No email on file." };
  if (row.email_verified_at) return { ok: false, error: "Email already verified." };
  const raw = await createEmailToken(me.id, "verify");
  await sendVerificationEmail(row.email, raw);
  return { ok: true };
}

/** Update opt-in communication preferences (default off). */
export async function setEmailPrefs(
  newsletter: boolean,
  events: boolean,
): Promise<EmailResult> {
  const me = await getCurrentProfile();
  if (!me) return { ok: false, error: "Not signed in." };
  await db
    .updateTable("profiles")
    .set({
      email_opt_newsletter: newsletter,
      email_opt_events: events,
      updated_at: new Date().toISOString(),
    })
    .where("id", "=", me.id)
    .execute();
  return { ok: true };
}
