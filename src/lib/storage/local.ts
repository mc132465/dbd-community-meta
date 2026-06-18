import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Local filesystem asset storage (Path B). Images live under public/assets and
 *
 * Images live under `public/assets/<pack>/<category>/<slug>.png`, so Next.js
 * serves them statically at `/assets/<pack>/<category>/<slug>.png`. The
 * multi-pack layout is preserved: the path is pack-scoped, mirroring the old
 * Storage key, and asset_pack_images still records storage_path + image_url.
 */
export const ASSETS_PUBLIC_DIR = resolve(process.cwd(), "public", "assets");

/** Pack-scoped relative key, e.g. "default/perks/sprint-burst.png". */
export function assetStorageKey(
  packSlug: string,
  category: string,
  slug: string,
): string {
  return `${packSlug}/${category}/${slug}.png`;
}

/** Public URL for a stored key, e.g. "/assets/default/perks/sprint-burst.png". */
export function assetPublicUrl(storageKey: string): string {
  return `/assets/${storageKey}`;
}

/** Write bytes to public/assets/<key>, creating directories as needed. */
export function saveAssetFile(storageKey: string, bytes: Buffer): void {
  const fullPath = resolve(ASSETS_PUBLIC_DIR, storageKey);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, bytes);
}
