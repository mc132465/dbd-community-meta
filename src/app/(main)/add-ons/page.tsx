import type { Metadata } from "next";
import Link from "next/link";

import { listAddOns } from "@/lib/services/assets.service";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";

export const metadata: Metadata = {
  title: "Add-ons",
  description: "Item and power add-ons.",
};

export default async function AddOnsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const addOns = await listAddOns();

  const filtered =
    q.length > 0
      ? addOns.filter((a) =>
          `${a.name} ${a.description ?? ""}`
            .toLowerCase()
            .includes(q.toLowerCase()),
        )
      : addOns;

  return (
    <div className="container space-y-8 py-12">
      <header>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Add-ons
        </h1>
        <p className="mt-2 text-muted-foreground">Item and power add-ons.</p>
        <form method="get" role="search" className="mt-4 max-w-sm">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search add-ons…"
            aria-label="Search add-ons"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring"
          />
        </form>
      </header>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q.length > 0 ? `No add-ons match “${q}”.` : "No add-ons yet."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((addOn) => (
            <li
              key={addOn.id}
              className="flex h-full flex-col gap-1 rounded-lg border border-border/60 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-border/60">
                  <AssetThumb
                    src={addOn.icon_url}
                    alt={addOn.name}
                    fallbackLabel={initialsFrom(addOn.name)}
                  />
                </div>
                <Link
                  href={`/add-ons/${addOn.slug}`}
                  className="min-w-0 flex-1 truncate font-display font-semibold uppercase tracking-wide hover:underline"
                >
                  {addOn.name}
                </Link>
                {addOn.rarity ? (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs capitalize text-muted-foreground">
                    {addOn.rarity}
                  </span>
                ) : null}
              </div>
              {addOn.description ? (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {addOn.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
