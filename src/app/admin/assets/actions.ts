"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/kysely";
import type { DB } from "@/lib/db/types";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import { assetConfigs, isAssetType } from "@/lib/admin/asset-config";

export type AssetMutationResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function requireStaff(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) {
    return { ok: false, error: "Not authorized." };
  }
  return { ok: true };
}

/** Coerce raw form values to DB-ready values per the field config. */
function normalize(type: string, values: Record<string, unknown>) {
  if (!isAssetType(type)) return null;
  const config = assetConfigs[type];
  const row: Record<string, unknown> = {};

  for (const field of config.fields) {
    const raw = values[field.name];
    if (field.type === "checkbox") {
      row[field.name] = Boolean(raw);
    } else {
      const str = typeof raw === "string" ? raw.trim() : raw;
      row[field.name] = str === "" || str === undefined ? null : str;
    }
  }
  return { config, row };
}

function mapError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === "23505") return "That slug or version already exists.";
  if (code === "23514") return "A field violates a database constraint.";
  return (err as Error)?.message ?? "Something went wrong.";
}

export async function createAsset(
  type: string,
  values: Record<string, unknown>,
): Promise<AssetMutationResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const normalized = normalize(type, values);
  if (!normalized) return { ok: false, error: "Unknown asset type." };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
    const created = await (db.insertInto(normalized.config.table as keyof DB) as any)
      .values(normalized.row)
      .returning("id")
      .executeTakeFirstOrThrow();
    revalidatePath(`/admin/assets/${type}`);
    return { ok: true, id: (created as { id: string }).id };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function updateAsset(
  type: string,
  id: string,
  values: Record<string, unknown>,
): Promise<AssetMutationResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const normalized = normalize(type, values);
  if (!normalized) return { ok: false, error: "Unknown asset type." };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
    await (db.updateTable(normalized.config.table as keyof DB) as any)
      .set(normalized.row)
      .where("id", "=", id)
      .execute();
    revalidatePath(`/admin/assets/${type}`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function deleteAsset(
  type: string,
  id: string,
): Promise<AssetMutationResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  if (!isAssetType(type)) return { ok: false, error: "Unknown asset type." };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
    await (db.deleteFrom(assetConfigs[type].table as keyof DB) as any)
      .where("id", "=", id)
      .execute();
    revalidatePath(`/admin/assets/${type}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
