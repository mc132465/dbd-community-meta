import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import { countPendingReview } from "@/lib/services/builds.service";
import { countPendingRevisions } from "@/lib/services/build-revisions.service";
import { countReviewQueue } from "@/lib/services/asset-review.service";
import { countOpenReports } from "@/lib/services/discussion-moderation.service";

/**
 * Role gate for the admin area. Middleware guarantees an authenticated user
 * reaches this point; here we additionally require moderator or admin.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login?next=/admin");
  if (!isModerator(profile.role)) redirect("/");

  const pending = await countPendingReview();
  const openReports = await countOpenReports();
  const pendingRevisions = await countPendingRevisions();
  const pendingAssets = await countReviewQueue();

  return (
    <div className="container py-12">
      <div className="mb-6">
        <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
          Staff area
        </span>
        <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight">
          Admin panel
        </h1>
      </div>

      <nav className="mb-8 flex flex-wrap items-center gap-1 border-b border-border/60 pb-3 text-sm">
        <Link
          href="/admin"
          className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
        >
          Dashboard
        </Link>

        {/* Content */}
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">
            Content
            {pending + pendingRevisions + openReports > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                {pending + pendingRevisions + openReports}
              </span>
            ) : null}
          </summary>
          <div className="absolute left-0 z-20 mt-1 flex w-56 flex-col rounded-md border border-border bg-popover p-1 shadow-lg">
            <Link href="/admin/builds" className="rounded px-2 py-1.5 hover:bg-accent">
              Builds
            </Link>
            <Link
              href="/admin/builds/queue"
              className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-accent"
            >
              Review queue
              {pending > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                  {pending}
                </span>
              ) : null}
            </Link>
            <Link
              href="/admin/builds/revisions"
              className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-accent"
            >
              Revisions
              {pendingRevisions > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                  {pendingRevisions}
                </span>
              ) : null}
            </Link>
            <Link
              href="/admin/recommendations"
              className="rounded px-2 py-1.5 hover:bg-accent"
            >
              Recommendations
            </Link>
            <Link
              href="/admin/moderation/content"
              className="rounded px-2 py-1.5 hover:bg-accent"
            >
              Content moderation
            </Link>
            <Link
              href="/admin/moderation"
              className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-accent"
            >
              Reports
              {openReports > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
                  {openReports}
                </span>
              ) : null}
            </Link>
          </div>
        </details>

        {/* Catalog */}
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">
            Catalog
            {pendingAssets > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-medium text-black">
                {pendingAssets}
              </span>
            ) : null}
          </summary>
          <div className="absolute left-0 z-20 mt-1 flex w-56 flex-col rounded-md border border-border bg-popover p-1 shadow-lg">
            <Link href="/admin/assets" className="rounded px-2 py-1.5 hover:bg-accent">
              Assets
            </Link>
            <Link href="/admin/assets/packs" className="rounded px-2 py-1.5 hover:bg-accent">
              Asset Packs
            </Link>
            <Link href="/admin/assets/mapping" className="rounded px-2 py-1.5 hover:bg-accent">
              Mapping
            </Link>
            <Link
              href="/admin/assets/review"
              className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-accent"
            >
              Review
              {pendingAssets > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-medium text-black">
                  {pendingAssets}
                </span>
              ) : null}
            </Link>
            <Link href="/admin/import" className="rounded px-2 py-1.5 hover:bg-accent">
              Import
            </Link>
            <Link href="/admin/tags" className="rounded px-2 py-1.5 hover:bg-accent">
              Tags
            </Link>
            <Link href="/admin/perk-labels" className="rounded px-2 py-1.5 hover:bg-accent">
              Perk Labels
            </Link>
          </div>
        </details>

        {/* Community */}
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">
            Community
          </summary>
          <div className="absolute left-0 z-20 mt-1 flex w-56 flex-col rounded-md border border-border bg-popover p-1 shadow-lg">
            <Link href="/admin/users" className="rounded px-2 py-1.5 hover:bg-accent">
              Users
            </Link>
            <Link href="/admin/recommendations" className="rounded px-2 py-1.5 hover:bg-accent">
              Recommendations
            </Link>
          </div>
        </details>

        {/* System */}
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">
            System
          </summary>
          <div className="absolute left-0 z-20 mt-1 flex w-56 flex-col rounded-md border border-border bg-popover p-1 shadow-lg">
            <Link href="/admin/theme" className="rounded px-2 py-1.5 hover:bg-accent">
              Theme
            </Link>
            <Link href="/admin/settings" className="rounded px-2 py-1.5 hover:bg-accent">
              Content settings
            </Link>
            <Link href="/admin/maintenance" className="rounded px-2 py-1.5 hover:bg-accent">
              Maintenance
            </Link>
            <Link href="/admin/backup" className="rounded px-2 py-1.5 hover:bg-accent">
              Backup
            </Link>
            <Link href="/admin/audit" className="rounded px-2 py-1.5 hover:bg-accent">
              Audit log
            </Link>
          </div>
        </details>
      </nav>

      {children}
    </div>
  );
}
