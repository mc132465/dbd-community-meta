import type { Metadata } from "next";
import Link from "next/link";

import { resetAction } from "../recovery-actions";

export const metadata: Metadata = { title: "Reset password · Fog Archives" };

export default function ResetPage({
  searchParams,
}: {
  searchParams: { token?: string; error?: string };
}) {
  const token = searchParams.token ?? "";
  const error = searchParams.error;

  if (!token) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <p className="text-sm text-destructive">Missing reset token.</p>
        <p className="mt-4 text-sm">
          <Link href="/forgot" className="underline underline-offset-2">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
        Choose a new password
      </h1>
      {error === "match" ? (
        <p className="mt-3 text-sm text-destructive">Passwords didn&apos;t match.</p>
      ) : error === "invalid" ? (
        <p className="mt-3 text-sm text-destructive">
          That reset link is invalid or has expired.{" "}
          <Link href="/forgot" className="underline underline-offset-2">
            Request a new one
          </Link>
          .
        </p>
      ) : null}
      <form action={resetAction} className="mt-4 space-y-3">
        <input type="hidden" name="token" value={token} />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="New password"
          autoComplete="new-password"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          placeholder="Confirm new password"
          autoComplete="new-password"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
        <button className="h-9 w-full rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
          Set new password
        </button>
      </form>
    </div>
  );
}
