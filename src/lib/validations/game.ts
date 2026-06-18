import { z } from "zod";

/**
 * Schemas for the canonical game-data JSON in `data/game/`. They validate the
 * IMPORT shape: parent references are by slug/version (resolved to ids by the
 * importer). Image fields are nullable and default to null in Phase 1.
 *
 * Shared between the importer (`scripts/import`) and the app so rules stay in
 * one place.
 */

const slug = z
  .string()
  .regex(/^[a-z0-9-]+$/, "Slugs use lowercase letters, numbers, and hyphens.");

const gameRole = z.enum(["killer", "survivor"]);
const addonRarity = z.enum([
  "common",
  "uncommon",
  "rare",
  "very_rare",
  "ultra_rare",
  "event",
]);
const addonTarget = z.enum(["killer_power", "item"]);

const base = {
  source: z.string().default("placeholder"),
  external_id: z.string().optional(),
};

export const patchImportSchema = z.object({
  version: z.string(),
  name: z.string().nullish(),
  released_at: z.string().nullish(),
  notes: z.string().nullish(),
  ...base,
});

export const characterImportSchema = z.object({
  role: gameRole,
  name: z.string(),
  slug,
  title: z.string().nullish(),
  lore: z.string().nullish(),
  power_name: z.string().nullish(),
  power_desc: z.string().nullish(),
  image_url: z.string().nullable().default(null),
  home_realm: z.string().nullish(),
  release_patch_version: z.string().nullish(),
  ...base,
});

export const perkImportSchema = z.object({
  role: gameRole,
  name: z.string(),
  slug,
  description: z.string().nullish(),
  icon_url: z.string().nullable().default(null),
  origin_character_slug: z.string().nullish(),
  is_teachable: z.boolean().default(false),
  ...base,
});

export const itemImportSchema = z.object({
  name: z.string(),
  slug,
  category: z.string().nullish(),
  description: z.string().nullish(),
  icon_url: z.string().nullable().default(null),
  ...base,
});

export const addOnImportSchema = z.object({
  name: z.string(),
  slug,
  rarity: addonRarity.default("common"),
  applies_to: addonTarget,
  parent_character_slug: z.string().nullish(),
  parent_item_slug: z.string().nullish(),
  description: z.string().nullish(),
  icon_url: z.string().nullable().default(null),
  ...base,
});

export const mapImportSchema = z.object({
  name: z.string(),
  slug,
  realm: z.string().nullish(),
  image_url: z.string().nullable().default(null),
  ...base,
});

export type PatchImport = z.infer<typeof patchImportSchema>;
export type CharacterImport = z.infer<typeof characterImportSchema>;
export type PerkImport = z.infer<typeof perkImportSchema>;
export type ItemImport = z.infer<typeof itemImportSchema>;
export type AddOnImport = z.infer<typeof addOnImportSchema>;
export type MapImport = z.infer<typeof mapImportSchema>;
