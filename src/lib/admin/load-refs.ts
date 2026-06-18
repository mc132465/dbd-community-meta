import "server-only";

import { db } from "@/lib/db/kysely";
import {
  assetConfigs,
  type AssetType,
  type AssetTypeConfig,
} from "@/lib/admin/asset-config";

export type RefOptions = Record<string, { value: string; label: string }[]>;

/** Loads select options for every `ref` field used by a config. */
export async function loadRefOptions(
  config: AssetTypeConfig,
): Promise<RefOptions> {
  const refOptions: RefOptions = {};

  const refTypes = Array.from(
    new Set(
      config.fields
        .filter((f) => f.type === "ref" && f.refType)
        .map((f) => f.refType as AssetType),
    ),
  );

  for (const refType of refTypes) {
    const refConfig = assetConfigs[refType];
    const displayCol = refType === "patches" ? "version" : "name";
    // Dynamic table/column — Kysely can't statically type these, so cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
    const rows = (await (db.selectFrom(refConfig.table as any) as any)
      .select(["id", displayCol])
      .orderBy(displayCol)
      .execute()) as Array<Record<string, string>>;

    refOptions[refType] = rows.map((row) => ({
      value: row.id,
      label: row[displayCol],
    }));
  }

  return refOptions;
}
