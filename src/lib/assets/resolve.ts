// Convention-based asset resolution. The single rule: an image lives at
//   public/assets/<category>/<slug>.png
// and is served at /assets/<category>/<slug>.png. If the file exists, it shows;
// if not, AssetThumb falls back to initials. The DB icon_url/image_url column is
// only an optional override (used when set). No packs, mapping, or review needed.
//
// Pure module (safe for client + server imports).

export type AssetCategory =
  | "perks"
  | "killers"
  | "survivors"
  | "items"
  | "addons"
  | "maps"
  | "offerings"
  | "powers";

/** Build the conventional public path for an asset, or null if slug is missing. */
export function assetSrc(
  category: AssetCategory,
  slug: string | null | undefined,
): string | null {
  if (!slug) return null;
  return `/assets/${category}/${slug}.png`;
}

/** Character images are split by role (killers vs survivors). */
export function characterCategory(
  role: "killer" | "survivor" | null | undefined,
): AssetCategory {
  return role === "survivor" ? "survivors" : "killers";
}

/**
 * Effective image source: an explicit DB override wins; otherwise fall back to
 * the convention path derived from category + slug.
 */
export function resolveAssetSrc(
  override: string | null | undefined,
  category: AssetCategory,
  slug: string | null | undefined,
): string | null {
  if (override) return override;
  return assetSrc(category, slug);
}
