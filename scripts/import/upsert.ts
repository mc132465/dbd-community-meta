import type { Kysely } from "kysely";

import type { DB } from "../../src/lib/db/types";

/**
 * Idempotent upsert keyed by a unique column (default `slug`). Re-running an
 * importer updates existing rows instead of creating duplicates. Returns a map
 * from the conflict key to the row id, used to resolve foreign keys for
 * dependent tables.
 *
 * Table/column names are dynamic here, so Kysely's static typing is bypassed
 * with casts; callers validate table names against the schema.
 */
export async function upsertByKey(
  db: Kysely<DB>,
  table: string,
  rows: Record<string, unknown>[],
  keyColumn = "slug",
): Promise<Map<string, string>> {
  if (rows.length === 0) return new Map();

  // Columns to refresh on conflict = every provided column except the key.
  const updateCols = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r))),
  ).filter((c) => c !== keyColumn);

  const result = (await (db.insertInto(table as any) as any)
    .values(rows)
    .onConflict((oc: any) =>
      oc.column(keyColumn).doUpdateSet(
        Object.fromEntries(
          updateCols.map((c) => [c, (eb: any) => eb.ref(`excluded.${c}`)]),
        ),
      ),
    )
    .returning(["id", keyColumn])
    .execute()) as Array<Record<string, string>>;

  const map = new Map<string, string>();
  for (const row of result) map.set(row[keyColumn], row.id);
  return map;
}
