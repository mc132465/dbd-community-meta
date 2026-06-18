import Link from "next/link";
import { RelatedDiscussions } from "@/components/discussions/related-discussions";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getBuildDetailBySlug } from "@/lib/services/builds.service";
import { getOpenRevision } from "@/lib/services/build-revisions.service";
import { listBuildVersions } from "@/lib/services/build-versions.service";
import { getViewer } from "@/lib/auth/authz";
import { deleteBuildFromDetailAction } from "./actions";
import {
  countComments,
  countLikes,
  hasFavorited,
  hasLiked,
  listComments,
  type CommentView,
} from "@/lib/services/engagement.service";
import { RarityBadge, RoleBadge } from "@/components/assets/asset-card";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import {
  DifficultyBadge,
  OfficialBadge,
  StatusBadge,
  TagChips,
} from "@/components/builds/badges";
import { LikeButton } from "@/components/builds/like-button";
import { SaveButton } from "@/components/builds/save-button";
import { CommentSection } from "@/components/builds/comment-section";

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const detail = await getBuildDetailBySlug(params.slug);
  if (!detail) return { title: "Build not found" };
  const name =
    detail.build.title || `${detail.character?.name ?? "Build"} loadout`;
  return { title: name };
}

export default async function BuildDetailPage({ params }: Params) {
  const detail = await getBuildDetailBySlug(params.slug);
  if (!detail) notFound();

  const { build, character, authorUsername, loadout, editorial, perkReasons, communityTags, officialTags } =
    detail;
  const official = detail.isOfficial;

  const difficulty = official
    ? editorial?.recommended_difficulty ?? null
    : build.difficulty_suggestion;
  const tags = official ? officialTags : communityTags;
  const title = build.title || `${character?.name ?? "Build"} loadout`;

  // Engagement (likes / favorites / comments) is only available on approved
  // builds. Authorization for any mutation lives in the service/actions.
  const isApproved = build.status === "approved";
  const viewer = await getViewer();
  const isLoggedIn = Boolean(viewer.userId);
  const loginHref = `/login?next=/builds/${build.slug}`;

  const versions = await listBuildVersions(build.id);

  const isAuthor = viewer.userId !== null && viewer.userId === build.author_id;
  const openRevision =
    isAuthor && (build.status === "approved" || build.status === "archived")
      ? await getOpenRevision(build.id)
      : null;

  let likeCount = 0;
  let commentCount = 0;
  let liked = false;
  let saved = false;
  let comments: CommentView[] = [];
  if (isApproved) {
    [likeCount, liked, saved, commentCount, comments] = await Promise.all([
      countLikes(build.id),
      hasLiked(build.id, viewer.userId),
      hasFavorited(build.id, viewer.userId),
      countComments(build.id),
      listComments(build.id),
    ]);
  }

  return (
    <div className="container max-w-3xl py-12">
      <Link
        href="/builds"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All builds
      </Link>

      {viewer.isStaff ? (
        build.deleted_at ? (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            This build is deleted and hidden from the public. Restore it from the
            admin builds panel.
          </p>
        ) : (
          <form action={deleteBuildFromDetailAction} className="mt-4">
            <input type="hidden" name="id" value={build.id} />
            <button className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
              Delete build (staff)
            </button>
          </form>
        )
      ) : null}

      {isAuthor ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/builds/${build.slug}/edit`}
            className="rounded-md border border-border/60 px-3 py-1.5 text-xs hover:border-border"
          >
            Edit build
          </Link>
          {openRevision ? (
            <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
              Your revision is awaiting review.
            </span>
          ) : null}
        </div>
      ) : null}

      <header className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            {title}
          </h1>
          {official ? (
            <OfficialBadge featured={editorial?.is_featured} />
          ) : null}
          {build.status !== "approved" ? (
            <StatusBadge status={build.status} />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {character ? (
            <>
              <AssetThumb
                src={character.image_url}
                alt={character.name}
                fallbackLabel={initialsFrom(character.name)}
                className="h-8 w-8 rounded"
              />
              <RoleBadge role={character.role} />
              <Link
                href={`/characters/${character.slug}`}
                className="hover:text-foreground"
              >
                {character.name}
              </Link>
            </>
          ) : (
            <RoleBadge role={build.role} />
          )}
          <DifficultyBadge value={difficulty} />
          {authorUsername ? <span>by @{authorUsername}</span> : null}
        </div>
        <TagChips tags={tags} />
      </header>

      {isApproved ? (
        <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-border/60 py-4">
          <LikeButton
            buildId={build.id}
            initialLiked={liked}
            initialCount={likeCount}
            isLoggedIn={isLoggedIn}
            loginHref={loginHref}
          />
          <SaveButton
            buildId={build.id}
            initialSaved={saved}
            isLoggedIn={isLoggedIn}
            loginHref={loginHref}
          />
          <a
            href="#comments"
            className="ml-auto text-sm text-muted-foreground hover:text-foreground"
          >
            {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </a>
        </div>
      ) : null}

      {/* Reasoning-first: per-perk explanations lead for official builds. */}
      <section className="mt-10">
        <h2 className="mb-4 font-display text-xl font-semibold uppercase tracking-wide">
          {official ? "Why This Build Works" : "Loadout"}
        </h2>
        {loadout.perks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No perks listed.</p>
        ) : (
          <ul className="space-y-3">
            {loadout.perks.map(({ slot, perk }) => {
              const reason = perkReasons[slot];
              return (
                <li
                  key={slot}
                  className="flex gap-3 rounded-lg border border-border/60 p-4"
                >
                  <AssetThumb
                    src={perk.icon_url}
                    alt={perk.name}
                    fallbackLabel={initialsFrom(perk.name)}
                    className="h-10 w-10 shrink-0 rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/perks/${perk.slug}`}
                      className="font-display font-semibold uppercase tracking-wide hover:text-link-hover"
                    >
                      {perk.name}
                    </Link>
                    {reason ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {reason}
                      </p>
                    ) : official ? null : perk.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {perk.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {loadout.item || loadout.addOns.length > 0 ? (
        <section className="mt-8 space-y-3">
          {loadout.item ? (
            <p className="flex items-center gap-2 text-sm">
              <AssetThumb
                src={loadout.item.icon_url}
                alt={loadout.item.name}
                fallbackLabel={initialsFrom(loadout.item.name)}
                className="h-8 w-8 rounded"
              />
              <span className="text-muted-foreground">Item: </span>
              {loadout.item.name}
            </p>
          ) : null}
          {loadout.addOns.length > 0 ? (
            <div>
              <span className="text-sm text-muted-foreground">Add-ons:</span>
              <ul className="mt-2 flex flex-wrap gap-2">
                {loadout.addOns.map(({ slot, addOn }) => (
                  <li
                    key={slot}
                    className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-sm"
                  >
                    <AssetThumb
                      src={addOn.icon_url}
                      alt={addOn.name}
                      fallbackLabel={initialsFrom(addOn.name)}
                      className="h-6 w-6 rounded"
                    />
                    {addOn.name}
                    <RarityBadge rarity={addOn.rarity} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {official && editorial ? (
        <>
          {editorial.overall_strategy ? (
            <Section title="Overall strategy">
              <p className="whitespace-pre-line text-muted-foreground">
                {editorial.overall_strategy}
              </p>
            </Section>
          ) : null}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {editorial.strengths ? (
              <div>
                <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Strengths
                </h3>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {editorial.strengths}
                </p>
              </div>
            ) : null}
            {editorial.weaknesses ? (
              <div>
                <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Weaknesses
                </h3>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {editorial.weaknesses}
                </p>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-10 text-sm text-muted-foreground">
          This is a community build (structured loadout). Editorial analysis is
          added by staff for featured builds.
        </p>
      )}

      {isApproved ? (
        <CommentSection
          buildId={build.id}
          isLoggedIn={isLoggedIn}
          loginHref={loginHref}
          initialComments={comments}
        />
      ) : null}

      {versions.length > 0 ? (
        <Section title="Revision history">
          <ul className="space-y-2 text-sm">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-border/60 px-3 py-2"
              >
                <span className="font-medium">v{v.versionNo}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs capitalize text-muted-foreground">
                  {v.kind.replace("_", " ")}
                </span>
                {v.authorName ? (
                  <span className="text-muted-foreground">by {v.authorName}</span>
                ) : null}
                <span className="text-muted-foreground">
                  · {new Date(v.createdAt).toISOString().slice(0, 10)}
                </span>
                {v.note ? (
                  <span className="w-full text-muted-foreground">{v.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <RelatedDiscussions buildId={build.id} />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-xl font-semibold uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}
