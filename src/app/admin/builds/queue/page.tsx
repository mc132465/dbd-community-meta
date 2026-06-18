import Link from "next/link";

import {
  getAuthorUsernames,
  getBuildLoadout,
  listPendingReview,
} from "@/lib/services/builds.service";
import { TagChips } from "@/components/builds/badges";
import { ReviewActions } from "@/components/builds/review-actions";

export default async function ReviewQueuePage() {
  const builds = await listPendingReview();
  const authors = await getAuthorUsernames(builds.map((b) => b.author_id));
  const loadouts = await Promise.all(
    builds.map((b) => getBuildLoadout(b.id)),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/builds"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Builds
        </Link>
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Review queue ({builds.length})
        </h2>
      </div>

      {builds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing awaiting review. 🎉
        </p>
      ) : (
        <ul className="space-y-4">
          {builds.map((build, i) => {
            const loadout = loadouts[i];
            return (
              <li
                key={build.id}
                className="space-y-3 rounded-lg border border-border/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/builds/${build.slug}`}
                      className="font-display font-semibold uppercase tracking-wide hover:text-link-hover"
                    >
                      {build.title ||
                        `${build.characters?.name ?? "Build"} loadout`}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      @{authors[build.author_id] ?? "—"} ·{" "}
                      {build.characters?.name ?? build.role} ·{" "}
                      {new Date(build.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ReviewActions buildId={build.id} />
                </div>

                <div className="text-sm">
                  <span className="text-muted-foreground">Perks: </span>
                  {loadout.perks.length > 0
                    ? loadout.perks.map((p) => p.perk.name).join(", ")
                    : "—"}
                </div>

                {loadout.addOns.length > 0 || loadout.item ? (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Loadout: </span>
                    {[
                      loadout.item?.name,
                      ...loadout.addOns.map((a) => a.addOn.name),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                ) : null}

                <TagChips tags={build.tags} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
