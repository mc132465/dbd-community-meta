import Link from "next/link";
import type { Metadata } from "next";

import { listPublishedTierLists } from "@/lib/services/tierlists.service";
import { listUserTierLists } from "@/lib/services/tier-list-editor.service";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { OfficialBadge } from "@/components/builds/badges";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Tier Lists",
  description: "Community and official killer & survivor tier lists.",
};

const CATEGORY_LABEL: Record<string, string> = {
  killer_perks: "Killer Perks",
  survivor_perks: "Survivor Perks",
  killers: "Killers",
  survivors: "Survivors",
  maps: "Maps",
  other: "Other",
};

const STATUS_TONE: Record<string, string> = {
  draft: "border-border text-muted-foreground",
  published: "border-badge-approved/40 text-badge-approved",
  archived: "border-border text-muted-foreground",
};

export default async function TierListsPage() {
  const [lists, profile] = await Promise.all([
    listPublishedTierLists(),
    getCurrentProfile(),
  ]);
  const myLists = profile ? await listUserTierLists() : [];

  const createHref = profile ? "/tier-lists/new" : "/login?next=/tier-lists/new";

  return (
    <div className="container max-w-4xl space-y-8 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            Tier Lists
          </h1>
          <p className="mt-2 text-muted-foreground">
            Rankings from the community and official sources.
          </p>
          <Link
            href="/tier-lists/community-meta"
            className="mt-2 inline-block text-sm text-primary underline underline-offset-2"
          >
            View the Community Meta →
          </Link>
        </div>
        <Button asChild>
          <Link href={createHref}>Create tier list</Link>
        </Button>
      </header>

      {/* My tier lists */}
      {profile && myLists.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            My tier lists
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {myLists.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABEL[l.category] ?? l.category}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${STATUS_TONE[l.status] ?? ""}`}
                  >
                    {l.status}
                  </span>
                  <Link
                    href={`/tier-lists/${l.slug}/edit`}
                    className="text-xs text-link hover:text-link-hover hover:underline"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Published lists */}
      <section className="space-y-3">
        {profile && myLists.length > 0 ? (
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Published
          </h2>
        ) : null}
        {lists.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tier lists published yet.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {lists.map((list) => (
              <li key={list.id}>
                <Link
                  href={`/tier-lists/${list.slug}`}
                  className="flex h-full flex-col gap-2 rounded-lg border border-border/60 p-4 transition-colors hover:border-border"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-semibold uppercase tracking-wide">
                      {list.title}
                    </span>
                    {list.isOfficial ? (
                      <OfficialBadge />
                    ) : (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Community
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABEL[list.category] ?? list.category}
                    {list.authorName ? <> · by {list.authorName}</> : null}
                  </p>
                  {list.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {list.description}
                    </p>
                  ) : null}
                  <span className="mt-auto text-xs text-muted-foreground">
                    {list.entryCount}{" "}
                    {list.entryCount === 1 ? "entry" : "entries"}
                    {list.publishedAt ? (
                      <>
                        {" · "}
                        {new Date(list.publishedAt).toLocaleDateString()}
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
