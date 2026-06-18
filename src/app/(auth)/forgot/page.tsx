import type { Metadata } from "next";
import Link from "next/link";

import { requestResetAction } from "../recovery-actions";

export const metadata: Metadata = { title: "Forgot password · Fog Archives" };

export default function ForgotPage({
  searchParams,
}: {
  searchParams: { sent?: string };
}) {
  const sent = searchParams.sent === "1";
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
        Forgot password
      </h1>
      {sent ? (
        <p className="mt-4 text-sm text-muted-foreground">
          If an account exists for that email, we&apos;ve sent a reset link. Check
          your inbox.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send a link to reset your password.
          </p>
          <form action={requestResetAction} className="mt-4 space-y-3">
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
            <button className="h-9 w-full rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
              Send reset link
            </button>
          </form>
        </>
      )}
      <p className="mt-6 text-sm">
        <Link href="/login" className="underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
      <p className="mt-2 text-sm">
        <Link href="/restore" className="text-muted-foreground underline underline-offset-2">
          Restore an archived account
        </Link>
      </p>
    </div>
  );
}
