import type { Metadata } from "next";
import Link from "next/link";

import { verifyEmail } from "@/lib/services/email-account.service";

export const metadata: Metadata = { title: "Verify email · Fog Archives" };

type Props = { searchParams: { token?: string } };

export default async function VerifyPage({ searchParams }: Props) {
  const token = searchParams.token ?? "";
  const result = token
    ? await verifyEmail(token)
    : ({ ok: false, error: "Missing verification token." } as const);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
        Email verification
      </h1>
      {result.ok ? (
        <p className="mt-4 text-emerald-400">
          Your email is verified. Thanks — your account is now recoverable.
        </p>
      ) : (
        <p className="mt-4 text-destructive">{result.error}</p>
      )}
      <div className="mt-6 flex justify-center gap-3 text-sm">
        <Link href="/" className="underline underline-offset-2">
          Go home
        </Link>
        {!result.ok ? (
          <Link href="/account" className="underline underline-offset-2">
            Resend verification
          </Link>
        ) : null}
      </div>
    </div>
  );
}
