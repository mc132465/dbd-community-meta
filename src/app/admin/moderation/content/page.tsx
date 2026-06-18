import Link from "next/link";
import type { Metadata } from "next";

import {
  listForModeration,
  type ModType,
} from "@/lib/services/moderation-content.service";
import { archiveAction, hardDeleteAction } from "./actions";

export const metadata: Metadata = { title: "Content moderation" };

const TABS: { key: ModType; label: string }[] = [
  { key: "builds", label: "Builds" },
  { key: "comments", label: "Comments" },
  { key: "tier_lists", label: "Tier lists" },
  { key: "discussions", label: "Discussions" },
];

function isType(v: string | undefined): v is ModType {
  return TABS.some((t) => t.key === v);
}

export default async function ContentModerationPage({
  searchParams,
}: {
  searchParams: { type?: string; q?: string };
}) {
  const type: ModType = isType(searchParams.type) ? searchParams.type : "builds";
  const q = (searchParams.q ?? "").trim();
  const items = await listForModeration(type, q);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
          Content moderation
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View, search, archive, and permanently delete community content. Archiving
          hides content; permanent deletion removes it and all its data for good.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 rounded-lg border border-border/60 p-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/moderation/content?type=${t.key}`}
            className={`rounded-md px-3 py-1.5 ${
              type === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <form method="get" role="search" className="flex max-w-sm gap-2">
        <input type="hidden" name="type" value={type} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={`Search ${type.replace("_", " ")}…`}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
        <button className="h-9 shrink-0 rounded-md border border-border px-3 text-sm">
          Search
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        {items.length} {items.length === 1 ? "item" : "items"}
        {q ? ` matching “${q}”` : ""}
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to show.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{item.title}</span>
                  {item.archived ? (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      archived
                    </span>
                  ) : null}
                </div>
                {item.subtitle ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {item.subtitle} · {item.createdAt.slice(0, 10)}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2 text-sm">
                {item.href ? (
                  <Link
                    href={item.href}
                    className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
                  >
                    Open
                  </Link>
                ) : null}

                <form action={archiveAction}>
                  <input type="hidden" name="type" value={type} />
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    type="hidden"
                    name="archived"
                    value={item.archived ? "false" : "true"}
                  />
                  <button className="rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground">
                    {item.archived ? "Restore" : "Archive"}
                  </button>
                </form>

                <details className="group relative">
                  <summary className="cursor-pointer list-none rounded-md border border-destructive/50 px-2 py-1 text-destructive hover:bg-destructive/10">
                    Delete forever
                  </summary>
                  <form
                    action={hardDeleteAction}
                    className="absolute right-0 z-10 mt-1 w-64 space-y-2 rounded-md border border-border bg-popover p-3 shadow-lg"
                  >
                    <input type="hidden" name="type" value={type} />
                    <input type="hidden" name="id" value={item.id} />
                    <p className="text-xs text-muted-foreground">
                      This permanently removes the {type.replace("_", " ")} and all
                      its data. Type <strong>DELETE</strong> to confirm.
                    </p>
                    <input
                      name="confirm"
                      required
                      pattern="DELETE"
                      autoComplete="off"
                      placeholder="DELETE"
                      className="h-8 w-full rounded border border-border bg-background px-2 text-sm"
                    />
                    <button className="h-8 w-full rounded bg-destructive text-sm font-medium text-destructive-foreground">
                      Permanently delete
                    </button>
                  </form>
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
