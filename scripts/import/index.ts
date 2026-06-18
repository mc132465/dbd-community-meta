import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  mapImportSchema,
  patchImportSchema,
} from "../../src/lib/validations/game";
import { createDb } from "../db/client";
import { upsertByKey } from "./upsert";
import { done, fail, ok, step } from "./log";

const DATA_DIR = resolve(process.cwd(), "data/game");

function readJson(file: string): unknown[] {
  const raw = readFileSync(resolve(DATA_DIR, file), "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${file} must contain a JSON array.`);
  }
  return parsed;
}

function validateAll<T>(
  records: unknown[],
  schema: { parse: (v: unknown) => T },
  file: string,
): T[] {
  return records.map((record, index) => {
    try {
      return schema.parse(record);
    } catch (error) {
      throw new Error(
        `Validation failed in ${file} at index ${index}: ${
          (error as Error).message
        }`,
      );
    }
  });
}

async function main() {
  const db = createDb();
  let total = 0;


  // 1. Patches (keyed by version) ----------------------------------
  step("Importing patches");
  const patches = validateAll(
    readJson("patches.json"),
    patchImportSchema,
    "patches.json",
  );
  const patchRows = patches.map((p) => ({
    version: p.version,
    name: p.name ?? null,
    released_at: p.released_at ?? null,
    notes: p.notes ?? null,
    source: p.source,
    external_id: p.external_id ?? null,
  }));
  await upsertByKey(db, "patches", patchRows, "version");
  ok("patches", patchRows.length);
  total += patchRows.length;

  // NOTE: characters are owned by the catalog seeder (`pnpm import:characters`);
  // perks, items, and add-ons by the asset pack (`pnpm import:assets`). This
  // seeder only provides placeholder types with no pack/catalog source: patches
  // and maps.

  // 2. Maps --------------------------------------------------------
  step("Importing maps");
  const maps = validateAll(readJson("maps.json"), mapImportSchema, "maps.json");
  const mapRows = maps.map((m) => ({
    name: m.name,
    slug: m.slug,
    realm: m.realm ?? null,
    image_url: m.image_url ?? null,
    source: m.source,
    external_id: m.external_id ?? null,
  }));
  await upsertByKey(db, "maps", mapRows);
  ok("maps", mapRows.length);
  total += mapRows.length;

  done(total);
  await db.destroy();
}

main().catch((error) => {
  fail((error as Error).message);
  process.exit(1);
});
