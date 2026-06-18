import "server-only";

import { db } from "@/lib/db/kysely";
import type {
  AddOnRow,
  CharacterRow,
  GameRole,
  ItemRow,
  MapRow,
  PerkRow,
} from "@/types/database";
import {
  assetSrc,
  characterCategory,
  type AssetCategory,
} from "@/lib/assets/resolve";

// Convention-based image defaults: the DB column is an optional override; when
// it is null we fall back to /assets/<category>/<slug>.png. AssetThumb degrades
// to initials if that file is absent, so "if a PNG exists, it shows."
function withCharacterImage(r: CharacterRow): CharacterRow {
  return { ...r, image_url: r.image_url ?? assetSrc(characterCategory(r.role), r.slug) };
}
function withIconUrl<T extends { icon_url: string | null; slug: string }>(
  r: T,
  category: AssetCategory,
): T {
  return { ...r, icon_url: r.icon_url ?? assetSrc(category, r.slug) };
}
function withImageUrl<T extends { image_url: string | null; slug: string }>(
  r: T,
  category: AssetCategory,
): T {
  return { ...r, image_url: r.image_url ?? assetSrc(category, r.slug) };
}

// ---------- Characters ----------
export async function listCharacters(role?: GameRole): Promise<CharacterRow[]> {
  let q = db.selectFrom("characters").selectAll().orderBy("name");
  if (role) q = q.where("role", "=", role);
  const rows = (await q.execute()) as CharacterRow[];
  return rows.map(withCharacterImage);
}

export async function getCharacterBySlug(
  slug: string,
): Promise<CharacterRow | null> {
  const row = await db
    .selectFrom("characters")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst();
  return row ? withCharacterImage(row as CharacterRow) : null;
}

/**
 * The killer's primary power as a first-class entity (the powers table), if one
 * exists. Carries the power icon resolved by the asset importer. The character
 * row also has denormalized power_name/power_desc; the page prefers this row's
 * fields when present and falls back to the character's.
 */
export type KillerPower = {
  name: string;
  slug: string;
  description: string | null;
  noob_explanation: string | null;
  icon_url: string | null;
};
export async function getKillerPower(
  characterId: string,
): Promise<KillerPower | null> {
  const row = await db
    .selectFrom("powers")
    .select(["name", "slug", "description", "noob_explanation", "icon_url"])
    .where("character_id", "=", characterId)
    .orderBy("created_at", "asc")
    .executeTakeFirst();
  if (!row) return null;
  return withIconUrl(row as KillerPower, "powers");
}

export async function getCharacterRefById(
  id: string,
): Promise<{ name: string; slug: string } | null> {
  const row = await db
    .selectFrom("characters")
    .select(["name", "slug"])
    .where("id", "=", id)
    .executeTakeFirst();
  return row ?? null;
}

export async function getPerkRefById(
  id: string,
): Promise<{ name: string; slug: string } | null> {
  const row = await db
    .selectFrom("perks")
    .select(["name", "slug"])
    .where("id", "=", id)
    .executeTakeFirst();
  return row ?? null;
}

export async function getPerksByOriginCharacter(
  characterId: string,
): Promise<PerkRow[]> {
  const rows = (await db
    .selectFrom("perks")
    .selectAll()
    .where("origin_character_id", "=", characterId)
    .orderBy("name")
    .execute()) as PerkRow[];
  return rows.map((r) => withIconUrl(r, "perks"));
}

export async function getAddOnsByCharacter(
  characterId: string,
): Promise<AddOnRow[]> {
  const rows = (await db
    .selectFrom("add_ons")
    .selectAll()
    .where("parent_character_id", "=", characterId)
    .orderBy("rarity")
    .execute()) as AddOnRow[];
  return rows.map((r) => withIconUrl(r, "addons"));
}

// ---------- Perks ----------
export async function listPerks(role?: GameRole): Promise<PerkRow[]> {
  let q = db.selectFrom("perks").selectAll().orderBy("name");
  if (role) q = q.where("role", "=", role);
  const rows = (await q.execute()) as PerkRow[];
  return rows.map((r) => withIconUrl(r, "perks"));
}

export async function getPerkBySlug(slug: string): Promise<PerkRow | null> {
  const row = await db
    .selectFrom("perks")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst();
  return row ? withIconUrl(row as PerkRow, "perks") : null;
}

// ---------- Items ----------
export async function listItems(): Promise<ItemRow[]> {
  const rows = (await db
    .selectFrom("items")
    .selectAll()
    .orderBy("name")
    .execute()) as ItemRow[];
  return rows.map((r) => withIconUrl(r, "items"));
}

export async function listAddOns(): Promise<AddOnRow[]> {
  const rows = (await db
    .selectFrom("add_ons")
    .selectAll()
    .orderBy("name")
    .execute()) as AddOnRow[];
  return rows.map((r) => withIconUrl(r, "addons"));
}

// ---------- Maps ----------
export async function listMaps(): Promise<MapRow[]> {
  const rows = (await db
    .selectFrom("maps")
    .selectAll()
    .orderBy("name")
    .execute()) as MapRow[];
  return rows.map((r) => withImageUrl(r, "maps"));
}

export async function getMapBySlug(slug: string): Promise<MapRow | null> {
  const row = await db
    .selectFrom("maps")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst();
  return row ? withImageUrl(row as MapRow, "maps") : null;
}

// ---------- Admin counts ----------
export async function getAssetCounts(): Promise<Record<string, number>> {
  const tables = [
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

  const entries = await Promise.all(
    tables.map(async (table) => {
      const row = await db
        .selectFrom(table)
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .executeTakeFirst();
      return [table, Number(row?.count ?? 0)] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export async function getItemBySlug(slug: string): Promise<ItemRow | null> {
  const row = await db
    .selectFrom("items")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst();
  return row ? withIconUrl(row as ItemRow, "items") : null;
}

export async function getAddOnBySlug(slug: string): Promise<AddOnRow | null> {
  const row = await db
    .selectFrom("add_ons")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst();
  return row ? withIconUrl(row as AddOnRow, "addons") : null;
}
