import type { Metadata } from "next";
import Link from "next/link";

import { requestRestoreAction, restoreAccountAction } from "../recovery-actions";

export const metadata: Metadata = { title: "Restore account · Fog Archives" };

export default function RestorePage({
  searchParams,
}: {
  searchParams: { token?: string; sent?: string; error?: string };
}) {
  const token = searchParams.token ?? "";

  // Confirm mode: a restore link was opened.
  if (token) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
          Restore account
        </h1>
        {searchParams.error === "1" ? (
          <p className="mt-3 text-sm text-destructive">
            This restore link is invalid or has expired.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Reactivate your account and sign back in.
            </p>
            <form action={restoreAccountAction} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <button className="h-9 w-full rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                Restore my account
              </button>
            </form>
          </>
        )}
      </div>
    );
  }

  // Request mode.
  const sent = searchParams.sent === "1";
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
        Restore account
      </h1>
      {sent ? (
        <p className="mt-4 text-sm text-muted-foreground">
          If an archived account exists for that email, we&apos;ve sent a restore
          link.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Archived your account? Enter your email to get a restore link.
          </p>
          <form action={requestRestoreAction} className="mt-4 space-y-3">
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
            <button className="h-9 w-full rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
              Send restore link
            </button>
          </form>
        </>
      )}
      <p className="mt-6 text-sm">
        <Link href="/login" className="underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
