import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { listBuildsByAuthor } from "@/lib/services/builds.service";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/assets/asset-card";
import { StatusBadge } from "@/components/builds/badges";

export const metadata: Metadata = { title: "My builds" };

export default async function MyBuildsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/builds/mine");

  const builds = await listBuildsByAuthor(profile.id);

  return (
    <div className="container max-w-3xl space-y-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          My builds
        </h1>
        <Button asChild>
          <Link href="/builds/new">Submit a build</Link>
        </Button>
      </div>

      {builds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t submitted any builds yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {builds.map((build) => (
            <li
              key={build.id}
              className="rounded-lg border border-border/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/builds/${build.slug}`}
                    className="font-display font-semibold uppercase tracking-wide hover:text-link-hover"
                  >
                    {build.title || `${build.characters?.name ?? "Build"} loadout`}
                  </Link>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {build.characters ? (
                      <>
                        <RoleBadge role={build.characters.role} />
                        <span>{build.characters.name}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <StatusBadge status={build.status} />
              </div>
              {build.status === "rejected" && build.review_note ? (
                <p className="mt-2 text-sm text-destructive">
                  Reviewer note: {build.review_note}
                </p>
              ) : null}
              {build.status === "pending_review" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Awaiting staff review — not public yet.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
