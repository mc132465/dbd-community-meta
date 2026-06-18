import Link from "next/link";

import { getMyEmailStatus } from "@/lib/services/email-account.service";

/**
 * Soft nag: prompts signed-in users to add or verify an email. Never blocks the
 * site (per the grandfathering decision). Renders nothing when signed out or
 * when the user already has a verified email.
 */
export async function EmailNagBanner() {
  const status = await getMyEmailStatus();
  if (!status) return null;
  if (status.email && status.verified) return null;

  const message = !status.email
    ? "Add an email so you can recover your account if you lose access."
    : "Please verify your email to secure account recovery.";

  return (
    <div className="bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-300">
      {message}{" "}
      <Link
        href="/account"
        className="font-medium underline underline-offset-2"
      >
        {status.email ? "Verify now" : "Add email"}
      </Link>
    </div>
  );
}
