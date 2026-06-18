import { OVERRIDES, overrideKey, type AssetOverride } from "./overrides";

export type AssetMeta = {
  slug: string;
  name: string;
  role?: "killer" | "survivor";
  applies_to?: "killer_power" | "item";
};

/**
 * Strip the pack's filename decorations to the bare asset name:
 *  - Unreal texture prefixes: `T_UI_`, `T_`
 *  - icon tokens: `iconPerks_`, `iconsFavors_`, `iconAddon_`, `icons_`, … (any
 *    `icon`/`icons` + word + `_`, case-insensitive)
 *  - character-portrait prefixes/suffixes: leading `K35_`/`S41_` and trailing
 *    `_Portrait` (e.g. `K35_TheUnknown_Portrait` → `TheUnknown`)
 *  - trailing internal killer codes: `_K39`
 */
function stripDecorations(fileBase: string): string {
  let n = fileBase;
  n = n.replace(/^T_UI_/i, "").replace(/^T_/i, "");
  n = n.replace(/^icons?[A-Za-z]*_/i, "");
  n = n.replace(/^[KS]\d+_/i, ""); // CharPortraits: K35_/S41_ prefix
  n = n.replace(/_Portrait$/i, ""); // CharPortraits: _Portrait suffix
  n = n.replace(/_K\d+$/i, "");
  return n;
}

/** CamelCase / mixed → kebab slug. */
export function toSlug(base: string): string {
  return base
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2") // camelCase boundary
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2") // ACRONYMWord → ACRONYM-Word
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Default display name from a slug: Title Case each word. */
function nameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Normalize one filename for a category. Returns null for files that should be
 * skipped entirely (e.g. `empty.png`, non-png).
 */
export function normalize(category: string, filename: string): AssetMeta | null {
  if (!/\.png$/i.test(filename)) return null;
  if (filename.toLowerCase() === "empty.png") return null;

  const fileBase = filename.replace(/\.png$/i, "");
  const stripped = stripDecorations(fileBase);
  let slug = toSlug(stripped);
  if (!slug) return null; // could not derive a usable slug → caller logs it

  let name = nameFromSlug(slug);

  const override: AssetOverride | undefined =
    OVERRIDES[overrideKey(category, slug)];
  if (override) {
    if (override.slug) slug = override.slug;
    if (override.name) name = override.name;
  }

  const meta: AssetMeta = { slug, name };
  if (override?.role) meta.role = override.role;
  if (override?.applies_to) meta.applies_to = override.applies_to;
  return meta;
}
