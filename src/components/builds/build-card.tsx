import Link from "next/link";

import type { BuildCard as BuildCardData } from "@/lib/services/builds.service";
import { RoleBadge } from "@/components/assets/asset-card";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import {
  DifficultyBadge,
  OfficialBadge,
  StatusBadge,
  TagChips,
} from "@/components/builds/badges";

export function BuildCard({
  build,
  showStatus = false,
  likeCount,
  commentCount,
}: {
  build: BuildCardData;
  showStatus?: boolean;
  likeCount?: number;
  commentCount?: number;
}) {
  // PostgREST may return a reverse one-to-one embed as an object or a 1-element array.
  const editorial = Array.isArray(build.build_editorials)
    ? build.build_editorials[0]
    : build.build_editorials;
  const official = Boolean(editorial?.published_at);
  const featured = Boolean(editorial?.is_featured);
  const title = build.title || `${build.characters?.name ?? "Build"} loadout`;
  const showCounts = likeCount !== undefined || commentCount !== undefined;

  return (
    <Link
      href={`/builds/${build.slug}`}
      className="flex gap-4 rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-border"
    >
      {build.characters ? (
        <AssetThumb
          src={build.characters.image_url}
          alt={build.characters.name}
          fallbackLabel={initialsFrom(build.characters.name)}
          className="h-16 w-16 shrink-0 rounded-md"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
            {title}
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {official ? <OfficialBadge featured={featured} /> : null}
            {showStatus ? <StatusBadge status={build.status} /> : null}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {build.characters ? (
            <>
              <RoleBadge role={build.characters.role} />
              <span>{build.characters.name}</span>
            </>
          ) : (
            <RoleBadge role={build.role} />
          )}
          <DifficultyBadge value={build.difficulty_suggestion} />
        </div>

        <TagChips tags={build.tags} />

        {showCounts ? (
          <div className="mt-1 flex items-center gap-3 border-t border-border/40 pt-3 text-xs text-muted-foreground tabular-nums">
            <span>
              {likeCount ?? 0} {(likeCount ?? 0) === 1 ? "like" : "likes"}
            </span>
            <span aria-hidden>·</span>
            <span>
              {commentCount ?? 0}{" "}
              {(commentCount ?? 0) === 1 ? "comment" : "comments"}
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
