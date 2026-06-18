/**
 * Field-driven configuration for the admin asset manager. One generic list +
 * form renders every asset type from this metadata, so adding a field is a
 * one-line change. Image fields are intentionally omitted in Phase 1 (assets
 * carry null images and the UI shows a neutral fallback).
 */

export const ASSET_TYPES = [
  "patches",
  "characters",
  "perks",
  "items",
  "add_ons",
  "maps",
  "powers",
  "offerings",
  "status_effects",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "checkbox"
  | "enum"
  | "ref";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  refType?: AssetType; // for `ref`: which table supplies options
};

export type AssetTypeConfig = {
  type: AssetType;
  label: string; // singular
  labelPlural: string;
  table: string;
  /** Unique column used for upsert/list ordering and display. */
  keyColumn: string;
  fields: Field[];
};

const ROLE_OPTIONS = [
  { value: "killer", label: "Killer" },
  { value: "survivor", label: "Survivor" },
];

const RARITY_OPTIONS = [
  { value: "common", label: "Common" },
  { value: "uncommon", label: "Uncommon" },
  { value: "rare", label: "Rare" },
  { value: "very_rare", label: "Very rare" },
  { value: "ultra_rare", label: "Ultra rare" },
  { value: "event", label: "Event" },
];

const TARGET_OPTIONS = [
  { value: "killer_power", label: "Killer power" },
  { value: "item", label: "Item" },
];

export const assetConfigs: Record<AssetType, AssetTypeConfig> = {
  patches: {
    type: "patches",
    label: "Patch",
    labelPlural: "Patches",
    table: "patches",
    keyColumn: "version",
    fields: [
      { name: "version", label: "Version", type: "text", required: true },
      { name: "name", label: "Name", type: "text" },
      { name: "released_at", label: "Released at", type: "date" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  characters: {
    type: "characters",
    label: "Character",
    labelPlural: "Characters",
    table: "characters",
    keyColumn: "slug",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      {
        name: "role",
        label: "Role",
        type: "enum",
        required: true,
        options: ROLE_OPTIONS,
      },
      { name: "title", label: "Title", type: "text" },
      { name: "chapter", label: "Release chapter", type: "text" },
      { name: "description", label: "Short description", type: "textarea" },
      { name: "lore", label: "Lore", type: "textarea" },
      { name: "power_name", label: "Power name", type: "text" },
      { name: "power_desc", label: "Power description", type: "textarea" },
      { name: "home_realm", label: "Home realm", type: "text" },
      {
        name: "release_patch_id",
        label: "Release patch",
        type: "ref",
        refType: "patches",
      },
    ],
  },
  perks: {
    type: "perks",
    label: "Perk",
    labelPlural: "Perks",
    table: "perks",
    keyColumn: "slug",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      {
        name: "role",
        label: "Role",
        type: "enum",
        required: true,
        options: ROLE_OPTIONS,
      },
      { name: "description", label: "Official description", type: "textarea" },
      {
        name: "noob_explanation",
        label: "For Noobs (plain-English explanation)",
        type: "textarea",
      },
      {
        name: "origin_character_id",
        label: "Origin character",
        type: "ref",
        refType: "characters",
      },
      { name: "is_teachable", label: "Teachable", type: "checkbox" },
    ],
  },
  items: {
    type: "items",
    label: "Item",
    labelPlural: "Items",
    table: "items",
    keyColumn: "slug",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "category", label: "Category", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },
  add_ons: {
    type: "add_ons",
    label: "Add-on",
    labelPlural: "Add-ons",
    table: "add_ons",
    keyColumn: "slug",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      {
        name: "rarity",
        label: "Rarity",
        type: "enum",
        required: true,
        options: RARITY_OPTIONS,
      },
      {
        name: "applies_to",
        label: "Applies to",
        type: "enum",
        required: true,
        options: TARGET_OPTIONS,
      },
      {
        name: "parent_character_id",
        label: "Parent character (power add-ons)",
        type: "ref",
        refType: "characters",
      },
      {
        name: "parent_item_id",
        label: "Parent item (item add-ons)",
        type: "ref",
        refType: "items",
      },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },
  maps: {
    type: "maps",
    label: "Map",
    labelPlural: "Maps",
    table: "maps",
    keyColumn: "slug",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "realm", label: "Realm", type: "text" },
    ],
  },
  powers: {
    type: "powers",
    label: "Power",
    labelPlural: "Powers",
    table: "powers",
    keyColumn: "slug",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "description", label: "Official description", type: "textarea" },
      {
        name: "noob_explanation",
        label: "For Noobs (plain-English explanation)",
        type: "textarea",
      },
      {
        name: "character_id",
        label: "Killer",
        type: "ref",
        refType: "characters",
      },
    ],
  },
  offerings: {
    type: "offerings",
    label: "Offering",
    labelPlural: "Offerings",
    table: "offerings",
    keyColumn: "slug",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },
  status_effects: {
    type: "status_effects",
    label: "Status effect",
    labelPlural: "Status effects",
    table: "status_effects",
    keyColumn: "slug",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },
};

export function isAssetType(value: string): value is AssetType {
  return (ASSET_TYPES as readonly string[]).includes(value);
}
