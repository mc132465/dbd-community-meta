import Link from "next/link";
import type { Metadata } from "next";

import { listItems } from "@/lib/services/assets.service";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";

export const metadata: Metadata = {
  title: "Items",
  description: "Survivor items and their details.",
};

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const items = await listItems();

  const filtered =
    q.length > 0
      ? items.filter((i) =>
          `${i.name} ${i.category ?? ""} ${i.description ?? ""}`
            .toLowerCase()
            .includes(q.toLowerCase()),
        )
      : items;

  return (
    <div className="container space-y-8 py-12">
      <header>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Items
        </h1>
        <p className="mt-2 text-muted-foreground">Survivor items.</p>
        <form method="get" role="search" className="mt-4 max-w-sm">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search items…"
            aria-label="Search items"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
          />
        </form>
      </header>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q.length > 0 ? `No items match “${q}”.` : "No items yet."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <li
              key={item.id}
              className="flex h-full flex-col gap-1 rounded-lg border border-border/60 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-border/60">
                  <AssetThumb
                    src={item.icon_url}
                    alt={item.name}
                    fallbackLabel={initialsFrom(item.name)}
                  />
                </div>
                <Link
                  href={`/items/${item.slug}`}
                  className="min-w-0 flex-1 truncate font-display font-semibold uppercase tracking-wide hover:underline"
                >
                  {item.name}
                </Link>
                {item.category ? (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs capitalize text-muted-foreground">
                    {item.category}
                  </span>
                ) : null}
              </div>
              {item.description ? (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
