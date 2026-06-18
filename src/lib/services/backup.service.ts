import "server-only";

import { z } from "zod";

import { db } from "@/lib/db/kysely";

/**
 * Phase A1 — read-only backup EXPORT. Builds a portable, versioned JSON
 * envelope from site_settings, asset_packs, and asset_pack_images. No writes,
 * no schema dependency beyond existing tables.
 *
 * Portability: environment-specific UUIDs (id, pack_id, asset_id) are dropped.
 * Packs are keyed by slug; images reference their pack by pack_slug and carry
 * asset_type + derived_slug (+ a `mapped` flag) so a future import can
 * re-resolve the catalog target instead of trusting a foreign UUID.
 */

export const BACKUP_VERSION = 1;
export const BACKUP_APP = "fog-archives";

export type BackupScope = "settings" | "assets" | "all";

export type SettingRow = { key: string; value: string };
export type PackRow = {
  slug: string;
  name: string;
  description: string | null;
  source_folder: string | null;
  is_default: boolean;
  is_active: boolean;
};
export type PackImageRow = {
  pack_slug: string;
  asset_type: string;
  source_file: string;
  derived_slug: string | null;
  mapping_mode: string;
  mapped: boolean;
  storage_path: string;
  image_url: string;
};

export type BackupEnvelope = {
  version: number;
  app: string;
  scope: BackupScope;
  exportedAt: string;
  tables: {
    site_settings?: SettingRow[];
    asset_packs?: PackRow[];
    asset_pack_images?: PackImageRow[];
  };
};

function normalizeScope(value: string | null): BackupScope {
  return value === "settings" || value === "assets" ? value : "all";
}

export { normalizeScope };

export async function buildBackup(scope: BackupScope): Promise<BackupEnvelope> {
  const tables: BackupEnvelope["tables"] = {};

  if (scope === "settings" || scope === "all") {
    const rows = await db
      .selectFrom("site_settings")
      .select(["key", "value"])
      .orderBy("key")
      .execute();
    tables.site_settings = rows.map((r) => ({ key: r.key, value: r.value }));
  }

  if (scope === "assets" || scope === "all") {
    const packs = await db
      .selectFrom("asset_packs")
      .select([
        "slug",
        "name",
        "description",
        "source_folder",
        "is_default",
        "is_active",
      ])
      .orderBy("slug")
      .execute();
    tables.asset_packs = packs.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      source_folder: p.source_folder,
      is_default: p.is_default,
      is_active: p.is_active,
    }));

    const images = await db
      .selectFrom("asset_pack_images")
      .innerJoin("asset_packs", "asset_packs.id", "asset_pack_images.pack_id")
      .select([
        "asset_packs.slug as pack_slug",
        "asset_pack_images.asset_type as asset_type",
        "asset_pack_images.source_file as source_file",
        "asset_pack_images.derived_slug as derived_slug",
        "asset_pack_images.mapping_mode as mapping_mode",
        "asset_pack_images.asset_id as asset_id",
        "asset_pack_images.storage_path as storage_path",
        "asset_pack_images.image_url as image_url",
      ])
      .orderBy("asset_packs.slug")
      .orderBy("asset_pack_images.asset_type")
      .orderBy("asset_pack_images.source_file")
      .execute();
    tables.asset_pack_images = images.map((i) => ({
      pack_slug: i.pack_slug,
      asset_type: i.asset_type,
      source_file: i.source_file,
      derived_slug: i.derived_slug,
      mapping_mode: i.mapping_mode,
      mapped: i.asset_id != null,
      storage_path: i.storage_path,
      image_url: i.image_url,
    }));
  }

  return {
    version: BACKUP_VERSION,
    app: BACKUP_APP,
    scope,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

// ===================== IMPORT PREVIEW (A2 — read-only) =====================

const ASSET_TYPES = [
  "perks",
  "killers",
  "survivors",
  "characters",
  "items",
  "add_ons",
  "maps",
  "offerings",
  "other",
] as const;

const envelopeSchema = z.object({
  version: z.number(),
  app: z.string(),
  scope: z.string().optional(),
  exportedAt: z.string().optional(),
  tables: z.object({
    site_settings: z.array(z.unknown()).optional(),
    asset_packs: z.array(z.unknown()).optional(),
    asset_pack_images: z.array(z.unknown()).optional(),
  }),
});

const settingRowSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});
const packRowSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  source_folder: z.string().nullable().optional(),
  is_default: z.boolean(),
  is_active: z.boolean(),
});
const imageRowSchema = z.object({
  pack_slug: z.string().min(1),
  asset_type: z.enum(ASSET_TYPES),
  source_file: z.string(),
  derived_slug: z.string().nullable().optional(),
  mapping_mode: z.string(),
  mapped: z.boolean(),
  storage_path: z.string(),
  image_url: z.string(),
});

export type TablePreview = { add: number; exists: number; invalid: number };
export type ImagesPreview = TablePreview & { wouldUnmap: number };

export type ImportPreview =
  | {
      ok: true;
      version: number;
      scope: string;
      settings?: TablePreview;
      packs?: TablePreview;
      images?: ImagesPreview;
      warnings: string[];
    }
  | { ok: false; error: string };

// asset_type → catalog target for resolving derived_slug (role-aware).
const ASSET_TYPE_TARGET: Record<
  string,
  { table: "perks" | "characters" | "items" | "add_ons" | "maps" | "offerings"; role: "killer" | "survivor" | null } | null
> = {
  perks: { table: "perks", role: null },
  killers: { table: "characters", role: "killer" },
  survivors: { table: "characters", role: "survivor" },
  characters: { table: "characters", role: null },
  items: { table: "items", role: null },
  add_ons: { table: "add_ons", role: null },
  maps: { table: "maps", role: null },
  offerings: { table: "offerings", role: null },
  other: null,
};

const MAX_WARNINGS = 50;

/** Validate + dry-run an uploaded backup. No writes. */
export async function previewImport(raw: unknown): Promise<ImportPreview> {
  const env = envelopeSchema.safeParse(raw);
  if (!env.success) {
    return { ok: false, error: "This file isn't a recognizable backup." };
  }
  if (env.data.version !== BACKUP_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup version ${env.data.version} (expected ${BACKUP_VERSION}).`,
    };
  }
  if (env.data.app !== BACKUP_APP) {
    return { ok: false, error: "This backup is from a different application." };
  }

  const warnings: string[] = [];
  const warn = (msg: string) => {
    if (warnings.length < MAX_WARNINGS) warnings.push(msg);
  };

  const out: Extract<ImportPreview, { ok: true }> = {
    ok: true,
    version: env.data.version,
    scope: env.data.scope ?? "all",
    warnings,
  };

  // ---- site_settings ----
  const settingsRaw = env.data.tables.site_settings;
  if (settingsRaw) {
    const existing = await db
      .selectFrom("site_settings")
      .select("key")
      .execute();
    const existingKeys = new Set(existing.map((r) => r.key));
    const preview: TablePreview = { add: 0, exists: 0, invalid: 0 };
    settingsRaw.forEach((row, i) => {
      const parsed = settingRowSchema.safeParse(row);
      if (!parsed.success) {
        preview.invalid++;
        warn(`site_settings[${i}]: invalid row.`);
        return;
      }
      if (existingKeys.has(parsed.data.key)) preview.exists++;
      else preview.add++;
    });
    out.settings = preview;
  }

  // ---- asset_packs ----
  const packsRaw = env.data.tables.asset_packs;
  const backupPackSlugs = new Set<string>();
  if (packsRaw) {
    const existing = await db.selectFrom("asset_packs").select("slug").execute();
    const existingSlugs = new Set(existing.map((r) => r.slug));
    const preview: TablePreview = { add: 0, exists: 0, invalid: 0 };
    packsRaw.forEach((row, i) => {
      const parsed = packRowSchema.safeParse(row);
      if (!parsed.success) {
        preview.invalid++;
        warn(`asset_packs[${i}]: invalid row.`);
        return;
      }
      backupPackSlugs.add(parsed.data.slug);
      if (existingSlugs.has(parsed.data.slug)) preview.exists++;
      else preview.add++;
    });
    out.packs = preview;
  }

  // ---- asset_pack_images ----
  const imagesRaw = env.data.tables.asset_pack_images;
  if (imagesRaw) {
    // Known packs = those already in the DB plus any included in this backup.
    const dbPacks = await db.selectFrom("asset_packs").select("slug").execute();
    const knownPackSlugs = new Set<string>([
      ...dbPacks.map((r) => r.slug),
      ...backupPackSlugs,
    ]);

    // Existing image identity keys: `${pack_slug}|${asset_type}|${source_file}`.
    const existingImages = await db
      .selectFrom("asset_pack_images")
      .innerJoin("asset_packs", "asset_packs.id", "asset_pack_images.pack_id")
      .select([
        "asset_packs.slug as pack_slug",
        "asset_pack_images.asset_type as asset_type",
        "asset_pack_images.source_file as source_file",
      ])
      .execute();
    const existingKeys = new Set(
      existingImages.map(
        (r) => `${r.pack_slug}|${r.asset_type}|${r.source_file}`,
      ),
    );

    // Validate rows first, collecting valid ones for catalog resolution.
    const valid: z.infer<typeof imageRowSchema>[] = [];
    const preview: ImagesPreview = { add: 0, exists: 0, invalid: 0, wouldUnmap: 0 };
    imagesRaw.forEach((row, i) => {
      const parsed = imageRowSchema.safeParse(row);
      if (!parsed.success) {
        preview.invalid++;
        warn(`asset_pack_images[${i}]: invalid row.`);
        return;
      }
      const d = parsed.data;
      if (!knownPackSlugs.has(d.pack_slug)) {
        preview.invalid++;
        warn(
          `asset_pack_images[${i}]: pack "${d.pack_slug}" not found (and not in this backup).`,
        );
        return;
      }
      valid.push(d);
    });

    // Resolve derived_slug → catalog per asset_type (role-aware), batched.
    const resolvedByType = new Map<string, Set<string>>();
    const byType = new Map<string, Set<string>>();
    for (const d of valid) {
      if (!d.mapped || !d.derived_slug) continue;
      const target = ASSET_TYPE_TARGET[d.asset_type];
      if (!target) continue;
      if (!byType.has(d.asset_type)) byType.set(d.asset_type, new Set());
      byType.get(d.asset_type)!.add(d.derived_slug);
    }
    for (const [type, slugs] of byType) {
      const target = ASSET_TYPE_TARGET[type]!;
      if (slugs.size === 0) {
        resolvedByType.set(type, new Set());
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
      let q = (db.selectFrom(target.table as any) as any)
        .select("slug")
        .where("slug", "in", [...slugs]);
      if (target.role) q = q.where("role", "=", target.role);
      const found = (await q.execute()) as { slug: string }[];
      resolvedByType.set(type, new Set(found.map((r) => r.slug)));
    }

    // Classify valid rows.
    for (const d of valid) {
      const key = `${d.pack_slug}|${d.asset_type}|${d.source_file}`;
      // Existence can only be confirmed against packs already in the DB.
      if (existingKeys.has(key)) preview.exists++;
      else preview.add++;

      if (d.mapped) {
        const target = ASSET_TYPE_TARGET[d.asset_type];
        const resolved =
          d.derived_slug != null &&
          target != null &&
          (resolvedByType.get(d.asset_type)?.has(d.derived_slug) ?? false);
        if (!resolved) preview.wouldUnmap++;
      }
    }
    if (preview.wouldUnmap > 0) {
      warn(
        `${preview.wouldUnmap} image(s) couldn't be matched to a catalog entry and would import as unmapped.`,
      );
    }
    out.images = preview;
  }

  return out;
}

/** Parse uploaded text then preview. Never throws on bad input. */
export async function previewImportFromText(
  text: string,
): Promise<ImportPreview> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  return previewImport(parsed);
}

// ===================== IMPORT APPLY (A3 — non-destructive) =====================

export type ApplyMode = "merge" | "overwrite";
export type ApplyTableResult = {
  added: number;
  updated: number;
  skipped: number;
  invalid: number;
};
export type ApplyImagesResult = ApplyTableResult & { unmapped: number };

export type ImportResult =
  | {
      ok: true;
      mode: ApplyMode;
      settings?: ApplyTableResult;
      packs?: ApplyTableResult;
      images?: ApplyImagesResult;
      warnings: string[];
    }
  | { ok: false; error: string };

/** Resolve derived_slug → catalog id per asset_type (role-aware), batched. */
async function resolveCatalogIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kysely transaction handle
  runner: any,
  rows: z.infer<typeof imageRowSchema>[],
): Promise<Map<string, Map<string, string>>> {
  const byType = new Map<string, Set<string>>();
  for (const d of rows) {
    if (!d.mapped || !d.derived_slug) continue;
    if (!ASSET_TYPE_TARGET[d.asset_type]) continue;
    if (!byType.has(d.asset_type)) byType.set(d.asset_type, new Set());
    byType.get(d.asset_type)!.add(d.derived_slug);
  }
  const out = new Map<string, Map<string, string>>();
  for (const [type, slugs] of byType) {
    const target = ASSET_TYPE_TARGET[type]!;
    if (slugs.size === 0) {
      out.set(type, new Map());
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
    let q = (runner.selectFrom(target.table as any) as any)
      .select(["id", "slug"])
      .where("slug", "in", [...slugs]);
    if (target.role) q = q.where("role", "=", target.role);
    const found = (await q.execute()) as { id: string; slug: string }[];
    const m = new Map<string, string>();
    for (const r of found) m.set(r.slug, r.id);
    out.set(type, m);
  }
  return out;
}

/**
 * Apply a validated backup. NON-DESTRUCTIVE: upserts by natural key, never
 * deletes. Merge inserts missing rows only; overwrite also updates existing
 * rows. Runs in a single transaction.
 */
export async function applyImport(
  raw: unknown,
  mode: ApplyMode,
): Promise<ImportResult> {
  const env = envelopeSchema.safeParse(raw);
  if (!env.success) {
    return { ok: false, error: "This file isn't a recognizable backup." };
  }
  if (env.data.version !== BACKUP_VERSION) {
    return { ok: false, error: `Unsupported backup version ${env.data.version}.` };
  }
  if (env.data.app !== BACKUP_APP) {
    return { ok: false, error: "This backup is from a different application." };
  }

  const warnings: string[] = [];
  const warn = (m: string) => {
    if (warnings.length < MAX_WARNINGS) warnings.push(m);
  };
  const result: Extract<ImportResult, { ok: true }> = { ok: true, mode, warnings };
  const now = new Date().toISOString();

  try {
    await db.transaction().execute(async (trx) => {
      // ---- site_settings ----
      const settingsRaw = env.data.tables.site_settings;
      if (settingsRaw) {
        const valid: z.infer<typeof settingRowSchema>[] = [];
        let invalid = 0;
        settingsRaw.forEach((row) => {
          const p = settingRowSchema.safeParse(row);
          if (p.success) valid.push(p.data);
          else invalid++;
        });
        const existing = await trx
          .selectFrom("site_settings")
          .select("key")
          .execute();
        const existingKeys = new Set(existing.map((r) => r.key));
        const toInsert = valid.filter((r) => !existingKeys.has(r.key));
        const toUpdate = valid.filter((r) => existingKeys.has(r.key));
        if (toInsert.length > 0) {
          await trx
            .insertInto("site_settings")
            .values(toInsert.map((r) => ({ key: r.key, value: r.value, updated_at: now })))
            .onConflict((oc) => oc.column("key").doNothing())
            .execute();
        }
        let updated = 0;
        if (mode === "overwrite") {
          for (const r of toUpdate) {
            await trx
              .updateTable("site_settings")
              .set({ value: r.value, updated_at: now })
              .where("key", "=", r.key)
              .execute();
            updated++;
          }
        }
        result.settings = {
          added: toInsert.length,
          updated,
          skipped: mode === "merge" ? toUpdate.length : 0,
          invalid,
        };
      }

      // ---- asset_packs (one-default rule respected) ----
      const packsRaw = env.data.tables.asset_packs;
      if (packsRaw) {
        const valid: z.infer<typeof packRowSchema>[] = [];
        let invalid = 0;
        packsRaw.forEach((row) => {
          const p = packRowSchema.safeParse(row);
          if (p.success) valid.push(p.data);
          else invalid++;
        });
        const existing = await trx
          .selectFrom("asset_packs")
          .select(["slug", "is_default"])
          .execute();
        const existingSlugs = new Set(existing.map((r) => r.slug));
        let defaultSlug: string | null =
          existing.find((r) => r.is_default)?.slug ?? null;

        let added = 0;
        let updated = 0;
        let skipped = 0;
        for (const p of valid) {
          // Resolve desired default without violating the one-default rule.
          let wantDefault = p.is_default;
          if (wantDefault && defaultSlug !== null && defaultSlug !== p.slug) {
            wantDefault = false;
            warn(
              `asset_packs "${p.slug}": another default pack exists; imported as non-default.`,
            );
          }
          if (wantDefault) defaultSlug = p.slug;

          if (!existingSlugs.has(p.slug)) {
            await trx
              .insertInto("asset_packs")
              .values({
                slug: p.slug,
                name: p.name,
                description: p.description ?? null,
                source_folder: p.source_folder ?? null,
                is_default: wantDefault,
                is_active: p.is_active,
              })
              .onConflict((oc) => oc.column("slug").doNothing())
              .execute();
            added++;
          } else if (mode === "overwrite") {
            await trx
              .updateTable("asset_packs")
              .set({
                name: p.name,
                description: p.description ?? null,
                source_folder: p.source_folder ?? null,
                is_default: wantDefault,
                is_active: p.is_active,
              })
              .where("slug", "=", p.slug)
              .execute();
            updated++;
          } else {
            skipped++;
          }
        }
        result.packs = { added, updated, skipped, invalid };
      }

      // ---- asset_pack_images ----
      const imagesRaw = env.data.tables.asset_pack_images;
      if (imagesRaw) {
        const packs = await trx
          .selectFrom("asset_packs")
          .select(["id", "slug"])
          .execute();
        const packIdBySlug = new Map(packs.map((r) => [r.slug, r.id]));

        const valid: z.infer<typeof imageRowSchema>[] = [];
        let invalid = 0;
        imagesRaw.forEach((row) => {
          const p = imageRowSchema.safeParse(row);
          if (!p.success) {
            invalid++;
            return;
          }
          if (!packIdBySlug.has(p.data.pack_slug)) {
            invalid++;
            warn(
              `asset_pack_images: pack "${p.data.pack_slug}" not found; row skipped.`,
            );
            return;
          }
          valid.push(p.data);
        });

        const resolved = await resolveCatalogIds(trx, valid);

        const existing = await trx
          .selectFrom("asset_pack_images")
          .innerJoin("asset_packs", "asset_packs.id", "asset_pack_images.pack_id")
          .select([
            "asset_packs.slug as pack_slug",
            "asset_pack_images.asset_type as asset_type",
            "asset_pack_images.source_file as source_file",
          ])
          .execute();
        const existingKeys = new Set(
          existing.map((r) => `${r.pack_slug}|${r.asset_type}|${r.source_file}`),
        );

        let added = 0;
        let updated = 0;
        let skipped = 0;
        let unmapped = 0;
        for (const d of valid) {
          const packId = packIdBySlug.get(d.pack_slug)!;
          let assetId: string | null = null;
          if (d.mapped && d.derived_slug && ASSET_TYPE_TARGET[d.asset_type]) {
            assetId = resolved.get(d.asset_type)?.get(d.derived_slug) ?? null;
          }
          if (d.mapped && assetId === null) unmapped++;

          const key = `${d.pack_slug}|${d.asset_type}|${d.source_file}`;
          if (!existingKeys.has(key)) {
            await trx
              .insertInto("asset_pack_images")
              .values({
                pack_id: packId,
                asset_type: d.asset_type,
                asset_id: assetId,
                source_file: d.source_file,
                derived_slug: d.derived_slug ?? null,
                mapping_mode: d.mapping_mode,
                storage_path: d.storage_path,
                image_url: d.image_url,
              })
              .onConflict((oc) =>
                oc.columns(["pack_id", "asset_type", "source_file"]).doNothing(),
              )
              .execute();
            added++;
          } else if (mode === "overwrite") {
            await trx
              .updateTable("asset_pack_images")
              .set({
                asset_id: assetId,
                derived_slug: d.derived_slug ?? null,
                mapping_mode: d.mapping_mode,
                storage_path: d.storage_path,
                image_url: d.image_url,
                updated_at: now,
              })
              .where("pack_id", "=", packId)
              .where("asset_type", "=", d.asset_type)
              .where("source_file", "=", d.source_file)
              .execute();
            updated++;
          } else {
            skipped++;
          }
        }
        result.images = { added, updated, skipped, invalid, unmapped };
      }
    });
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Import failed." };
  }

  return result;
}

/** Parse uploaded text then apply. Never throws on bad JSON. */
export async function applyImportFromText(
  text: string,
  mode: ApplyMode,
): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  return applyImport(parsed, mode);
}
