import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { getMyEmailStatus } from "@/lib/services/email-account.service";
import { isAdmin } from "@/lib/auth/roles";
import { UsernameForm } from "@/components/account/username-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  resendVerificationAction,
  setEmailAction,
  setEmailPrefsAction,
} from "./email/actions";
import { requestSelfDeletionAction } from "./delete/actions";

export const metadata: Metadata = { title: "Account" };

const COOLDOWN_DAYS = 30;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { deletion?: string };
}) {
  // Middleware already blocks unauthenticated access; this is a safety net.
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/account");
  const email = await getMyEmailStatus();

  // When the next username change becomes available (null = available now).
  const availableAt =
    !isAdmin(profile.role) && profile.last_username_change_at
      ? new Date(
          new Date(profile.last_username_change_at).getTime() +
            COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;

  const status = email?.status ?? "active";

  return (
    <div className="container max-w-2xl space-y-6 py-12">
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
        Account
      </h1>
      <p className="text-sm text-muted-foreground">
        Everything about your account lives here — username, email, status, and
        deletion.
      </p>

      {/* Status & role */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">@{profile.username}</CardTitle>
          <CardDescription>Your account details.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="capitalize">{profile.role}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="capitalize">
              <span
                className={
                  status === "active"
                    ? "text-emerald-400"
                    : status === "suspended"
                      ? "text-amber-400"
                      : "text-destructive"
                }
              >
                {status}
              </span>
            </dd>
            <dt className="text-muted-foreground">Joined</dt>
            <dd>{new Date(profile.created_at).toLocaleDateString()}</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Username */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Username</CardTitle>
          <CardDescription>
            Your username is public and unique. Changing it does not affect your
            login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsernameForm
            currentUsername={profile.username}
            availableAt={availableAt}
          />
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email</CardTitle>
          <CardDescription>
            Used for account recovery and verification. Newsletters and event
            reminders are opt-in and only sent once your email is verified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Current:</span>
            <span className="font-medium">{email?.email ?? "none on file"}</span>
            {email?.email ? (
              email.verified ? (
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-400">
                  Verified
                </span>
              ) : (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-400">
                  Unverified
                </span>
              )
            ) : null}
          </div>

          <form action={setEmailAction} className="flex flex-col gap-2 sm:flex-row">
            <input
              name="email"
              type="email"
              required
              defaultValue={email?.email ?? ""}
              placeholder="you@example.com"
              autoComplete="email"
              className="flex-1 rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
            />
            <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              {email?.email ? "Change email" : "Add email"}
            </button>
          </form>

          {email?.email && !email.verified ? (
            <form action={resendVerificationAction}>
              <button className="text-sm text-primary underline underline-offset-2">
                Resend verification email
              </button>
            </form>
          ) : null}

          <form action={setEmailPrefsAction} className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-sm font-medium">Email preferences</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="newsletter"
                defaultChecked={email?.newsletter}
                className="h-4 w-4"
              />
              Newsletter
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="events"
                defaultChecked={email?.events}
                className="h-4 w-4"
              />
              Event reminders
            </label>
            <button className="rounded-md border border-border/60 px-3 py-1.5 text-sm hover:border-border">
              Save preferences
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Community profile (separate editor) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Community profile</CardTitle>
          <CardDescription>
            Avatar, bio, playstyle, favorite/most-hated killers, and privacy.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href="/account/profile"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Edit profile
          </Link>
          <Link
            href={`/u/${profile.username}`}
            className="rounded-md border border-border/60 px-4 py-2 text-sm hover:border-border"
          >
            View public profile
          </Link>
        </CardContent>
      </Card>

      {/* Account deletion */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg">Delete account</CardTitle>
          <CardDescription>
            Archives your account and signs you out. Public content is kept but
            shown as “[deleted]”; a moderator finalizes removal, and you can
            restore from your email beforehand. We email a confirmation link first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {searchParams.deletion === "sent" ? (
            <p className="rounded-lg border border-border/60 bg-card p-3 text-sm text-muted-foreground">
              We&apos;ve emailed you a confirmation link. Open it to archive your
              account, or ignore it to stay active.
            </p>
          ) : (
            <>
              {searchParams.deletion === "noemail" ? (
                <p className="text-sm text-destructive">
                  Add and verify an email above before deleting your account.
                </p>
              ) : null}
              <form action={requestSelfDeletionAction}>
                <button className="h-9 rounded-md border border-destructive/50 px-3 text-sm text-destructive hover:bg-destructive/10">
                  Email me a deletion link
                </button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
