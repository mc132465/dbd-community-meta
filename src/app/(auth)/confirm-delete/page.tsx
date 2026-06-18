import type { Metadata } from "next";
import Link from "next/link";

import { confirmDeleteAction } from "../recovery-actions";

export const metadata: Metadata = { title: "Confirm deletion · Fog Archives" };

export default function ConfirmDeletePage({
  searchParams,
}: {
  searchParams: { token?: string; error?: string };
}) {
  const token = searchParams.token ?? "";

  if (!token || searchParams.error === "1") {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <p className="text-sm text-destructive">
          This confirmation link is invalid or has expired.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/" className="underline underline-offset-2">
            Go home
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
        Confirm account deletion
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This archives your account and signs you out. Your public content is kept
        but shown as “[deleted]”, and a moderator finalizes removal. You can ask to
        restore your account from the same email before that happens.
      </p>
      <form action={confirmDeleteAction} className="mt-4">
        <input type="hidden" name="token" value={token} />
        <button className="h-9 w-full rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground">
          Delete my account
        </button>
      </form>
    </div>
  );
}
