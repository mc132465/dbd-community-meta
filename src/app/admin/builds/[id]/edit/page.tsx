import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getBuildDetailBySlug,
  getBuildSlugById,
} from "@/lib/services/builds.service";
import { listActiveTags } from "@/lib/services/tags.service";
import { StatusBadge } from "@/components/builds/badges";
import { ReviewActions } from "@/components/builds/review-actions";
import { EditorialForm } from "@/components/builds/editorial-form";

type Params = { params: { id: string } };

export default async function EditBuildPage({ params }: Params) {
  const slug = await getBuildSlugById(params.id);
  if (!slug) notFound();

  const [detail, tags] = await Promise.all([
    getBuildDetailBySlug(slug),
    listActiveTags(),
  ]);
  if (!detail) notFound();

  const { build, character, loadout, editorial, perkReasons, officialTags } =
    detail;
  const title = build.title || `${character?.name ?? "Build"} loadout`;

  const perkSlots = loadout.perks.map(({ slot, perk }) => ({
    slot,
    name: perk.name,
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/admin/builds"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Builds
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
            {title}
          </h2>
          <StatusBadge status={build.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {character?.name ?? build.role} · perks:{" "}
          {perkSlots.map((p) => p.name).join(", ") || "none"}
        </p>
      </div>

      {build.status === "pending_review" ? (
        <div className="rounded-lg border border-border/60 p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            This build is awaiting review.
          </p>
          <ReviewActions buildId={build.id} />
        </div>
      ) : null}

      <EditorialForm
        buildId={build.id}
        perkSlots={perkSlots}
        tags={tags.map((t) => ({ id: t.id, name: t.name }))}
        initial={{
          overall_strategy: editorial?.overall_strategy ?? "",
          strengths: editorial?.strengths ?? "",
          weaknesses: editorial?.weaknesses ?? "",
          recommended_difficulty: editorial?.recommended_difficulty ?? "",
          official_tag_ids: officialTags.map((t) => t.id),
          is_featured: editorial?.is_featured ?? false,
          published: Boolean(editorial?.published_at),
          perk_reasons: perkReasons,
        }}
      />
    </div>
  );
}
