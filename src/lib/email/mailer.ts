import "server-only";

/**
 * Email transport. Uses SMTP (nodemailer) when SMTP_HOST/SMTP_PORT are set;
 * otherwise falls back to a console log so verification/recovery flows work in
 * development without a mail server. nodemailer is imported lazily so the log
 * path never requires the package at runtime.
 */

export type OutgoingMail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

/** Absolute URL for an app path, based on APP_URL (defaults to localhost). */
export function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendMail(mail: OutgoingMail): Promise<void> {
  if (!smtpConfigured()) {
    // Dev/log fallback — print instead of sending.
    console.log(
      `[email:dev] to=${mail.to}\nsubject=${mail.subject}\n${mail.text}\n`,
    );
    return;
  }
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "Fog Archives <no-reply@localhost>",
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}
