import Link from "next/link";
import type { Metadata } from "next";

import {
  listActiveDiscussionCategories,
  listThreads,
  type ThreadSort,
} from "@/lib/services/discussions.service";
import { threadScores } from "@/lib/services/discussion-votes.service";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Discussions",
  description: "Community questions, strategy talk, and patch discussion.",
};

type SP = { sort?: string; category?: string; q?: string };

const SORTS: { key: ThreadSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "active", label: "Most active" },
  { key: "unanswered", label: "Unanswered" },
];

function parseSort(v: string | undefined): ThreadSort {
  return v === "active" || v === "unanswered" ? v : "newest";
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function hrefWith(opts: { sort: ThreadSort; category?: string; q?: string }) {
  const p = new URLSearchParams();
  if (opts.sort !== "newest") p.set("sort", opts.sort);
  if (opts.category) p.set("category", opts.category);
  if (opts.q) p.set("q", opts.q);
  const qs = p.toString();
  return qs ? `/discussions?${qs}` : "/discussions";
}

const statusBadge: Record<string, string> = {
  open: "",
  locked: "border-amber-500/40 text-amber-500",
  archived: "border-muted-foreground/40 text-muted-foreground",
};

export default async function DiscussionsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sort = parseSort(searchParams.sort);
  const category = searchParams.category?.trim() || undefined;
  const q = searchParams.q?.trim() || undefined;

  const [categories, { items }, profile] = await Promise.all([
    listActiveDiscussionCategories(),
    listThreads({ sort, categorySlug: category, search: q }),
    getCurrentProfile(),
  ]);

  const scores = await threadScores(items.map((t) => t.id));

  const startHref = profile
    ? "/discussions/new"
    : "/login?next=/discussions/new";
  const hasFilters = Boolean(category || q);

  return (
    <div className="container max-w-4xl space-y-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            Discussions
          </h1>
          <p className="mt-2 text-muted-foreground">
            Questions, strategy, perks, and patch talk.
          </p>
        </div>
        <Button asChild>
          <Link href={startHref}>Start a discussion</Link>
        </Button>
      </header>

      {/* Search */}
      <form method="get" action="/discussions" className="flex gap-2">
        {sort !== "newest" ? (
          <input type="hidden" name="sort" value={sort} />
        ) : null}
        {category ? (
          <input type="hidden" name="category" value={category} />
        ) : null}
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search discussions…"
          className="max-w-sm"
          aria-label="Search discussions"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {/* Sort tabs */}
      <div className="flex flex-wrap gap-2">
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={hrefWith({ sort: s.key, category, q })}
            aria-pressed={sort === s.key}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              sort === s.key
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/40"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Category chips */}
      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href={hrefWith({ sort, q })}
            aria-pressed={!category}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              !category
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/40"
            }`}
          >
            All
          </Link>
          {categories.map((c) => {
            const active = category === c.slug;
            return (
              <Link
                key={c.id}
                href={hrefWith({ sort, category: c.slug, q })}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground/40"
                }`}
              >
                {c.name}
              </Link>
            );
          })}
        </div>
      ) : null}

      {/* List */}
      {items.length === 0 ? (
        <p className="rounded-lg border border-border/60 p-6 text-sm text-muted-foreground">
          {hasFilters || sort === "unanswered"
            ? "No discussions match these filters. Try clearing the search or category."
            : "No discussions yet. Be the first to start one."}
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
          {items.map((t) => (
            <li key={t.id} className="flex items-start gap-4 p-4">
              <div className="w-12 shrink-0 text-center">
                <div className="text-sm font-semibold">{scores[t.id] ?? 0}</div>
                <div className="text-[10px] uppercase text-muted-foreground">
                  votes
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/discussions/${t.slug}`}
                    className="font-display font-semibold tracking-wide hover:text-link-hover"
                  >
                    {t.title}
                  </Link>
                  {t.status !== "open" ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${statusBadge[t.status] ?? ""}`}
                    >
                      {t.status}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.categoryName ? (
                    <>
                      <span className="text-foreground/70">{t.categoryName}</span>
                      {" · "}
                    </>
                  ) : null}
                  by {t.authorName} · {t.replyCount}{" "}
                  {t.replyCount === 1 ? "reply" : "replies"} · active{" "}
                  {timeAgo(t.lastActivityAt)} · started{" "}
                  {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
