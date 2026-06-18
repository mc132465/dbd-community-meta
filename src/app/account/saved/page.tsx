import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentProfile } from "@/lib/services/profile.service";
import {
  engagementCountsByBuildIds,
  listSavedBuilds,
} from "@/lib/services/engagement.service";
import { BuildCard } from "@/components/builds/build-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Saved builds" };

export default async function SavedBuildsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/account/saved");

  // listSavedBuilds returns approved, non-deleted builds only (most recently
  // saved first), so pending/private builds are never exposed via favorites.
  const builds = await listSavedBuilds(profile.id);
  const counts = await engagementCountsByBuildIds(builds.map((b) => b.id));

  return (
    <div className="container max-w-4xl space-y-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            Saved builds
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Builds you&apos;ve favorited. Only approved builds appear here.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/account">Account</Link>
        </Button>
      </div>

      {builds.length === 0 ? (
        <div className="rounded-lg border border-border/60 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            You haven&apos;t saved any builds yet.
          </p>
          <Button asChild className="mt-4">
            <Link href="/builds">Browse builds</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {builds.map((build) => (
            <BuildCard
              key={build.id}
              build={build}
              likeCount={counts.get(build.id)?.likes}
              commentCount={counts.get(build.id)?.comments}
            />
          ))}
        </div>
      )}
    </div>
  );
}
