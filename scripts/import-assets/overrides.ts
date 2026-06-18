/**
 * Overrides for cases where mechanical filename → slug/name normalization is
 * insufficient: apostrophes, accents, acronyms, and known pack typos.
 *
 * Keyed by `<category>:<derived-slug>` (the slug the normalizer produces from
 * the filename). Each entry may correct the slug and/or the display name, and
 * optionally enrich role (perks) or applies_to (add-ons).
 *
 * This is intentionally NOT exhaustive — only exceptions need an entry. Add more
 * as you spot them in the unmatched/problematic report.
 */

export type AssetOverride = {
  slug?: string; // corrected slug (e.g. fix a pack typo)
  name?: string; // exact display name (apostrophes/accents/acronyms)
  role?: "killer" | "survivor"; // perks only
  applies_to?: "killer_power" | "item"; // add-ons only
};

export const OVERRIDES: Record<string, AssetOverride> = {
  // ----- Perks: punctuation / accents the slug can't carry -----
  "perks:a-nurses-calling": { name: "A Nurse's Calling" },
  "perks:plunderers-instinct": { name: "Plunderer's Instinct" },
  "perks:well-make-it": { name: "We'll Make It" },
  "perks:hex-no-one-escapes-death": { name: "Hex: No One Escapes Death" },
  "perks:deja-vu": { name: "Déjà Vu" },
  "perks:self-care": { name: "Self-Care" },
  "perks:quick-quiet": { name: "Quick & Quiet" },
  // Known pack typo: "Thatanophobia" → Thanatophobia
  "perks:thatanophobia": { slug: "thanatophobia", name: "Thanatophobia" },

  // ----- Add-ons: example acronym/punctuation -----
  // "add-ons:bbq-and-chili": { name: "BBQ & Chili" },
};

export function overrideKey(category: string, slug: string): string {
  return `${category}:${slug}`;
}
