import "server-only";

import { appUrl, sendMail } from "@/lib/email/mailer";

export async function sendVerificationEmail(
  to: string,
  rawToken: string,
): Promise<void> {
  const link = appUrl(`/verify?token=${encodeURIComponent(rawToken)}`);
  await sendMail({
    to,
    subject: "Verify your email — Fog Archives",
    text:
      `Welcome to Fog Archives!\n\n` +
      `Confirm your email by opening this link:\n${link}\n\n` +
      `If you didn't create this account, you can ignore this message.`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
): Promise<void> {
  const link = appUrl(`/reset?token=${encodeURIComponent(rawToken)}`);
  await sendMail({
    to,
    subject: "Reset your password — Fog Archives",
    text:
      `We received a request to reset your password.\n\n` +
      `Open this link to choose a new password (valid for 1 hour):\n${link}\n\n` +
      `If you didn't request this, you can ignore this message.`,
  });
}

export async function sendRestoreEmail(
  to: string,
  rawToken: string,
): Promise<void> {
  const link = appUrl(`/restore?token=${encodeURIComponent(rawToken)}`);
  await sendMail({
    to,
    subject: "Restore your account — Fog Archives",
    text:
      `You can restore your archived account by opening this link:\n${link}\n\n` +
      `If you didn't request this, you can ignore this message.`,
  });
}

export async function sendDeleteConfirmEmail(
  to: string,
  rawToken: string,
): Promise<void> {
  const link = appUrl(`/confirm-delete?token=${encodeURIComponent(rawToken)}`);
  await sendMail({
    to,
    subject: "Confirm account deletion — Fog Archives",
    text:
      `You requested to delete your account.\n\n` +
      `Open this link to confirm (valid for 1 hour). Your account will be archived\n` +
      `and removed by a moderator:\n${link}\n\n` +
      `If you didn't request this, ignore this message and your account stays active.`,
  });
}
