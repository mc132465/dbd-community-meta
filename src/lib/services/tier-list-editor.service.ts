import "server-only";

import { sql } from "kysely";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import { slugify } from "@/lib/builds/constants";
import {
  addEntrySchema,
  createTierListSchema,
  moveEntrySchema,
  tierLabelsSchema,
  updateTierListSchema,
  type TierCategory,
} from "@/lib/validations/tier-list";

/**
 * Tier-list creation/management (Step 2). Author-scoped; staff (moderator/
 * admin) can manage any list. Category-safe: each category only accepts a
 * specific target kind, validated before an entry is written.
 */

export type TierResult = { ok: true } | { ok: false; error: string };
export type CreateTierResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };
export type AddEntryResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const DEFAULT_LABELS = ["S", "A", "B", "C", "D", "F"];

/** Category → allowed target kind, table, and role filter. */
const CATEGORY_RULES: Record<
  TierCategory,
  {
    targetType: "perk" | "character" | "map" | "custom";
    table: "perks" | "characters" | "maps" | null;
    role: "killer" | "survivor" | null;
    field: "perkId" | "characterId" | "mapId" | "customLabel";
  }
> = {
  killer_perks: { targetType: "perk", table: "perks", role: "killer", field: "perkId" },
  survivor_perks: { targetType: "perk", table: "perks", role: "survivor", field: "perkId" },
  killers: { targetType: "character", table: "characters", role: "killer", field: "characterId" },
  survivors: { targetType: "character", table: "characters", role: "survivor", field: "characterId" },
  maps: { targetType: "map", table: "maps", role: null, field: "mapId" },
  other: { targetType: "custom", table: null, role: null, field: "customLabel" },
};

function jsonbLabels(labels: string[]) {
  return sql<string[]>`${JSON.stringify(labels)}::jsonb`;
}

// ---------- ownership ----------

type OwnedList = {
  id: string;
  author_id: string | null;
  category: string;
  tier_labels: string[];
  status: string;
};

async function loadOwned(
  tierListId: string,
): Promise<
  { ok: true; list: OwnedList; userId: string } | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sign in first." };

  const list = await db
    .selectFrom("tier_lists")
    .select(["id", "author_id", "category", "tier_labels", "status"])
    .where("id", "=", tierListId)
    .executeTakeFirst();
  if (!list) return { ok: false, error: "Tier list not found." };

  const isOwner = list.author_id === profile.id;
  if (!isOwner && !isModerator(profile.role)) {
    return { ok: false, error: "You can only edit your own tier list." };
  }
  return {
    ok: true,
    userId: profile.id,
    list: {
      id: list.id,
      author_id: list.author_id,
      category: list.category,
      tier_labels: (list.tier_labels as string[]) ?? DEFAULT_LABELS,
      status: list.status,
    },
  };
}

// ---------- slug ----------

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title).slice(0, 80) || "tier-list";
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const hit = await db
      .selectFrom("tier_lists")
      .select("id")
      .where("slug", "=", candidate)
      .executeTakeFirst();
    if (!hit) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- list CRUD ----------

export async function createTierList(
  input: unknown,
): Promise<CreateTierResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sign in to create a tier list." };

  const parsed = createTierListSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const d = parsed.data;
  const slug = await uniqueSlug(d.title);

  try {
    const row = await db
      .insertInto("tier_lists")
      .values({
        author_id: profile.id,
        title: d.title,
        slug,
        description: d.description ? d.description : null,
        category: d.category,
        tier_labels: jsonbLabels(d.tier_labels ?? DEFAULT_LABELS),
        is_official: false,
        status: "draft",
      })
      .returning(["id", "slug"])
      .executeTakeFirstOrThrow();
    return { ok: true, id: row.id, slug: row.slug };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Create failed." };
  }
}

export async function updateTierList(
  tierListId: string,
  input: unknown,
): Promise<TierResult> {
  const owned = await loadOwned(tierListId);
  if (!owned.ok) return owned;

  const parsed = updateTierListSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const d = parsed.data;

  // Changing category is only safe when there are no entries yet.
  if (d.category && d.category !== owned.list.category) {
    const existing = await db
      .selectFrom("tier_list_entries")
      .select("id")
      .where("tier_list_id", "=", tierListId)
      .executeTakeFirst();
    if (existing) {
      return {
        ok: false,
        error: "Remove all entries before changing the category.",
      };
    }
  }

  try {
    await db
      .updateTable("tier_lists")
      .set({
        title: d.title,
        description: d.description ? d.description : null,
        ...(d.category ? { category: d.category } : {}),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", tierListId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Update failed." };
  }
  return { ok: true };
}

export async function updateTierLabels(
  tierListId: string,
  input: unknown,
): Promise<TierResult> {
  const owned = await loadOwned(tierListId);
  if (!owned.ok) return owned;

  const parsed = tierLabelsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }

  try {
    await db
      .updateTable("tier_lists")
      .set({
        tier_labels: jsonbLabels(parsed.data.labels),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", tierListId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Update failed." };
  }
  return { ok: true };
}

export async function publishTierList(
  tierListId: string,
): Promise<TierResult> {
  const owned = await loadOwned(tierListId);
  if (!owned.ok) return owned;

  const hasEntry = await db
    .selectFrom("tier_list_entries")
    .select("id")
    .where("tier_list_id", "=", tierListId)
    .executeTakeFirst();
  if (!hasEntry) {
    return { ok: false, error: "Add at least one entry before publishing." };
  }

  try {
    await db
      .updateTable("tier_lists")
      .set({
        status: "published",
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", tierListId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Publish failed." };
  }
  return { ok: true };
}

export async function archiveTierList(
  tierListId: string,
): Promise<TierResult> {
  const owned = await loadOwned(tierListId);
  if (!owned.ok) return owned;
  try {
    await db
      .updateTable("tier_lists")
      .set({ status: "archived", updated_at: new Date().toISOString() })
      .where("id", "=", tierListId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Archive failed." };
  }
  return { ok: true };
}

export async function deleteTierList(
  tierListId: string,
): Promise<TierResult> {
  const owned = await loadOwned(tierListId);
  if (!owned.ok) return owned;
  try {
    await db.deleteFrom("tier_lists").where("id", "=", tierListId).execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Delete failed." };
  }
  return { ok: true };
}

// ---------- reads for editing ----------

export type UserTierList = {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  updatedAt: string;
};

export async function listUserTierLists(): Promise<UserTierList[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const rows = await db
    .selectFrom("tier_lists")
    .select(["id", "title", "slug", "category", "status", "updated_at"])
    .where("author_id", "=", profile.id)
    .orderBy("updated_at", "desc")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    category: r.category,
    status: r.status,
    updatedAt: r.updated_at,
  }));
}

export type EditableEntry = {
  id: string;
  tier: string;
  position: number;
  targetType: string;
  targetId: string | null;
  label: string;
  iconUrl: string | null;
};

export type EditableTierList = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  tierLabels: string[];
  status: string;
  entries: EditableEntry[];
};

export async function getEditableTierList(
  tierListId: string,
): Promise<EditableTierList | null> {
  const owned = await loadOwned(tierListId);
  if (!owned.ok) return null;

  const list = await db
    .selectFrom("tier_lists")
    .selectAll()
    .where("id", "=", tierListId)
    .executeTakeFirst();
  if (!list) return null;

  const rows = await db
    .selectFrom("tier_list_entries")
    .leftJoin("perks", "perks.id", "tier_list_entries.perk_id")
    .leftJoin("characters", "characters.id", "tier_list_entries.character_id")
    .leftJoin("maps", "maps.id", "tier_list_entries.map_id")
    .select((eb) => [
      "tier_list_entries.id as id",
      "tier_list_entries.tier as tier",
      "tier_list_entries.position as position",
      "tier_list_entries.target_type as target_type",
      "tier_list_entries.perk_id as perk_id",
      "tier_list_entries.character_id as character_id",
      "tier_list_entries.map_id as map_id",
      "tier_list_entries.custom_label as custom_label",
      eb.ref("perks.name").as("perk_name"),
      eb.ref("perks.icon_url").as("perk_icon"),
      eb.ref("characters.name").as("character_name"),
      eb.ref("characters.image_url").as("character_icon"),
      eb.ref("maps.name").as("map_name"),
    ])
    .where("tier_list_entries.tier_list_id", "=", tierListId)
    .orderBy("tier_list_entries.position")
    .execute();

  const entries: EditableEntry[] = rows.map((r) => {
    const targetId =
      r.perk_id ?? r.character_id ?? r.map_id ?? null;
    const label =
      (r.perk_name as string | null) ??
      (r.character_name as string | null) ??
      (r.map_name as string | null) ??
      (r.custom_label as string | null) ??
      "—";
    const iconUrl =
      (r.perk_icon as string | null) ??
      (r.character_icon as string | null) ??
      null;
    return {
      id: r.id,
      tier: r.tier,
      position: r.position,
      targetType: r.target_type,
      targetId,
      label,
      iconUrl,
    };
  });

  return {
    id: list.id,
    title: list.title,
    slug: list.slug,
    description: list.description,
    category: list.category,
    tierLabels: (list.tier_labels as string[]) ?? DEFAULT_LABELS,
    status: list.status,
    entries,
  };
}

// ---------- entry CRUD (category-safe) ----------

/** Verify a target id exists in the category's table (and role). */
async function targetValid(
  table: "perks" | "characters" | "maps",
  id: string,
  role: "killer" | "survivor" | null,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
  let q = (db.selectFrom(table as any) as any)
    .select("id")
    .where("id", "=", id);
  if (role) q = q.where("role", "=", role);
  const row = await q.executeTakeFirst();
  return Boolean(row);
}

export async function addEntry(input: unknown): Promise<AddEntryResult> {
  const parsed = addEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const d = parsed.data;

  const owned = await loadOwned(d.tierListId);
  if (!owned.ok) return owned;

  if (!owned.list.tier_labels.includes(d.tier)) {
    return { ok: false, error: "Unknown tier label." };
  }

  const rule = CATEGORY_RULES[owned.list.category as TierCategory];
  if (!rule) return { ok: false, error: "Unknown category." };

  // Category-safe target resolution.
  const values: {
    tier_list_id: string;
    tier: string;
    target_type: string;
    perk_id: string | null;
    character_id: string | null;
    map_id: string | null;
    custom_label: string | null;
    position: number;
  } = {
    tier_list_id: d.tierListId,
    tier: d.tier,
    target_type: rule.targetType,
    perk_id: null,
    character_id: null,
    map_id: null,
    custom_label: null,
    position: 0,
  };

  if (rule.targetType === "custom") {
    if (!d.customLabel) {
      return { ok: false, error: "Enter a label for this entry." };
    }
    values.custom_label = d.customLabel;
  } else {
    const id =
      rule.field === "perkId"
        ? d.perkId
        : rule.field === "characterId"
          ? d.characterId
          : d.mapId;
    if (!id) {
      return {
        ok: false,
        error: `This list expects a ${rule.targetType} target.`,
      };
    }
    if (rule.table && !(await targetValid(rule.table, id, rule.role))) {
      return {
        ok: false,
        error: `That target isn't a valid ${owned.list.category} entry.`,
      };
    }
    if (rule.targetType === "perk") values.perk_id = id;
    else if (rule.targetType === "character") values.character_id = id;
    else if (rule.targetType === "map") values.map_id = id;
  }

  // Append at the end of the target tier.
  const last = await db
    .selectFrom("tier_list_entries")
    .select((eb) => eb.fn.max("position").as("max"))
    .where("tier_list_id", "=", d.tierListId)
    .where("tier", "=", d.tier)
    .executeTakeFirst();
  values.position = Number(last?.max ?? -1) + 1;

  try {
    const row = await db
      .insertInto("tier_list_entries")
      .values(values)
      .returning("id")
      .executeTakeFirstOrThrow();
    await touch(d.tierListId);
    return { ok: true, id: row.id };
  } catch (err) {
    const msg =
      (err as { code?: string })?.code === "23505"
        ? "That target is already in this list."
        : (err as Error)?.message ?? "Add failed.";
    return { ok: false, error: msg };
  }
}

export async function moveEntry(input: unknown): Promise<TierResult> {
  const parsed = moveEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const d = parsed.data;

  const entry = await db
    .selectFrom("tier_list_entries")
    .select(["id", "tier_list_id"])
    .where("id", "=", d.entryId)
    .executeTakeFirst();
  if (!entry) return { ok: false, error: "Entry not found." };

  const owned = await loadOwned(entry.tier_list_id);
  if (!owned.ok) return owned;
  if (!owned.list.tier_labels.includes(d.tier)) {
    return { ok: false, error: "Unknown tier label." };
  }

  try {
    await db
      .updateTable("tier_list_entries")
      .set({ tier: d.tier, position: d.position })
      .where("id", "=", d.entryId)
      .execute();
    await touch(entry.tier_list_id);
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Move failed." };
  }
  return { ok: true };
}

export async function removeEntry(entryId: string): Promise<TierResult> {
  const entry = await db
    .selectFrom("tier_list_entries")
    .select(["id", "tier_list_id"])
    .where("id", "=", entryId)
    .executeTakeFirst();
  if (!entry) return { ok: false, error: "Entry not found." };

  const owned = await loadOwned(entry.tier_list_id);
  if (!owned.ok) return owned;

  try {
    await db
      .deleteFrom("tier_list_entries")
      .where("id", "=", entryId)
      .execute();
    await touch(entry.tier_list_id);
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Remove failed." };
  }
  return { ok: true };
}

async function touch(tierListId: string): Promise<void> {
  await db
    .updateTable("tier_lists")
    .set({ updated_at: new Date().toISOString() })
    .where("id", "=", tierListId)
    .execute();
}

/** Resolve a tier list by slug for editing (author/staff). */
export async function getEditableTierListBySlug(
  slug: string,
): Promise<EditableTierList | null> {
  const row = await db
    .selectFrom("tier_lists")
    .select("id")
    .where("slug", "=", slug)
    .executeTakeFirst();
  if (!row) return null;
  return getEditableTierList(row.id);
}

export type PoolTarget = { id: string; name: string; iconUrl: string | null };

/**
 * Candidate targets for a category's drag-and-drop pool (role-filtered).
 * "other" has no catalog pool (entries are free-form text).
 */
export async function listTargetPool(
  category: string,
): Promise<PoolTarget[]> {
  const rule = CATEGORY_RULES[category as TierCategory];
  if (!rule || !rule.table) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
  let q = (db.selectFrom(rule.table as any) as any).select(["id", "name"]);
  if (rule.role) q = q.where("role", "=", rule.role);

  // perks use icon_url; characters and maps use image_url.
  const iconCol = rule.table === "perks" ? "icon_url" : "image_url";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic column
  q = (q as any).select(`${iconCol} as icon_url`);

  const rows = (await q.orderBy("name").execute()) as {
    id: string;
    name: string;
    icon_url: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    iconUrl: r.icon_url ?? null,
  }));
}
