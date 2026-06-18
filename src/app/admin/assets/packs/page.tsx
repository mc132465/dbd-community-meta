import Link from "next/link";
import type { Metadata } from "next";

import {
  detectMissingImages,
  listAssetPacks,
  listCategoryTargets,
  listPackImages,
  type AssetCategory,
} from "@/lib/services/asset-admin.service";
import { AssetImageCard } from "@/components/admin/asset-image-card";

export const metadata: Metadata = { title: "Asset Packs · Admin" };

const CATEGORIES: AssetCategory[] = [
  "perks",
  "killers",
  "survivors",
  "characters",
  "items",
  "add_ons",
  "maps",
  "offerings",
  "powers",
  "other",
];

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  perks: "Perks",
  killers: "Killers",
  survivors: "Survivors",
  characters: "Characters",
  items: "Items",
  add_ons: "Add-ons",
  maps: "Maps",
  offerings: "Offerings",
  powers: "Powers",
  other: "Other",
};

type Filter = "all" | "assigned" | "unassigned" | "missing";

type SP = { pack?: string; category?: string; filter?: string };

function parseCategory(v: string | undefined): AssetCategory {
  return CATEGORIES.includes(v as AssetCategory)
    ? (v as AssetCategory)
    : "perks";
}

function parseFilter(v: string | undefined): Filter {
  return v === "assigned" || v === "unassigned" || v === "missing"
    ? v
    : "all";
}

function href(pack: string, category: AssetCategory, filter: Filter) {
  const p = new URLSearchParams({ pack, category });
  if (filter !== "all") p.set("filter", filter);
  return `/admin/assets/packs?${p.toString()}`;
}

export default async function AssetPacksPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const packs = await listAssetPacks();

  if (packs.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Asset Packs
        </h2>
        <p className="text-sm text-muted-foreground">
          No asset packs yet. Import one with{" "}
          <code className="rounded bg-muted px-1">
            pnpm import:assets --pack=&lt;slug&gt;
          </code>{" "}
          (folders under{" "}
          <code className="rounded bg-muted px-1">data/assets/packs/</code>).
        </p>
      </div>
    );
  }

  const activePackSlug = searchParams.pack ?? packs[0].slug;
  const pack = packs.find((p) => p.slug === activePackSlug) ?? packs[0];
  const category = parseCategory(searchParams.category);
  const filter = parseFilter(searchParams.filter);

  const assigned =
    filter === "assigned" ? true : filter === "unassigned" ? false : undefined;

  const [images, targets, missing] = await Promise.all([
    filter === "missing"
      ? Promise.resolve([])
      : listPackImages({ packId: pack.id, category, assigned }),
    listCategoryTargets(category),
    detectMissingImages(category),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Asset Packs
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize imported images by pack and category. Auto-mapping is the
          default; manual assignment always wins and stays within the category.
        </p>
      </div>

      {/* Pack selector */}
      <div className="flex flex-wrap gap-2">
        {packs.map((p) => {
          const active = p.slug === pack.slug;
          return (
            <Link
              key={p.id}
              href={href(p.slug, category, filter)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              {p.name}
              {p.isDefault ? (
                <span className="ml-1 text-[10px] uppercase">· default</span>
              ) : null}
              <span className="ml-1 text-[10px] text-muted-foreground">
                ({p.imageCount})
              </span>
            </Link>
          );
        })}
      </div>

      {/* Category selector */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const active = c === category;
          return (
            <Link
              key={c}
              href={href(pack.slug, c, filter)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              {CATEGORY_LABEL[c]}
            </Link>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 text-sm">
        {(["all", "assigned", "unassigned", "missing"] as Filter[]).map((f) => {
          const active = f === filter;
          const label =
            f === "all"
              ? "All images"
              : f === "assigned"
                ? "Assigned"
                : f === "unassigned"
                  ? "Unmapped"
                  : "Missing targets";
          return (
            <Link
              key={f}
              href={href(pack.slug, category, f)}
              className={`rounded-md border px-3 py-1.5 transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      {filter === "missing" ? (
        <section className="space-y-2">
          <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {CATEGORY_LABEL[category]} with no image ({missing.length})
          </h3>
          {missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every {CATEGORY_LABEL[category].toLowerCase()} entry has an image.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {missing.map((m) => (
                <li
                  key={m.id}
                  className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
                >
                  {m.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {m.slug}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {images.length} image{images.length === 1 ? "" : "s"} ·{" "}
            {missing.length} target{missing.length === 1 ? "" : "s"} still
            missing an image
          </p>
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No images in this pack/category for this filter.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((img) => (
                <AssetImageCard
                  key={img.id}
                  image={{
                    id: img.id,
                    category: img.category,
                    sourceFile: img.sourceFile,
                    imageUrl: img.imageUrl,
                    mappingMode: img.mappingMode,
                    assetId: img.assetId,
                    assignedName: img.assignedName,
                  }}
                  targets={targets}
                  assignable={category !== "other"}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
