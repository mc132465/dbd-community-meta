import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createDb } from "../db/client";
import { done, fail, ok, step, warn } from "../import/log";

const SOURCE = "dbd-universal-perk-seed";

type PerkSeed = {
  name: string;
  slug: string;
  role?: "killer" | "survivor";
};

function loadCatalog(): PerkSeed[] {
  const raw = readFileSync(
    resolve(process.cwd(), "data/perks/catalog.json"),
    "utf-8",
  );
  const parsed = JSON.parse(raw) as { perks?: PerkSeed[] };
  if (!Array.isArray(parsed.perks)) {
    throw new Error("data/perks/catalog.json must have a `perks` array.");
  }
  return parsed.perks;
}

async function main() {
  const db = createDb();
  const perks = loadCatalog();

  step(`Importing ${perks.length} universal perks`);

  let created = 0;
  let updated = 0;

  for (const perk of perks) {
    if (!perk.slug || !perk.name) {
      warn(`Skipping perk with missing name/slug: ${JSON.stringify(perk)}`);
      continue;
    }

    // Did this perk already exist (from a previous run or another source)?
    const existing = await db
      .selectFrom("perks")
      .select("id")
      .where("slug", "=", perk.slug)
      .executeTakeFirst();

    // Insert with canonical identity; on conflict refresh ONLY the canonical
    // fields. icon_url and origin_character_id are intentionally NOT in the
    // update set, so an icon attached later by import:assets — and any origin —
    // is preserved across re-runs. Universal perks are seeded with origin null.
    await db
      .insertInto("perks")
      .values({
        slug: perk.slug,
        name: perk.name,
        role: perk.role ?? "killer",
        origin_character_id: null,
        is_teachable: false,
        source: SOURCE,
      })
      .onConflict((oc) =>
        oc.column("slug").doUpdateSet({
          name: perk.name,
          role: perk.role ?? "killer",
          is_teachable: false,
          source: SOURCE,
        }),
      )
      .execute();

    if (existing) updated += 1;
    else created += 1;
  }

  ok("perks", perks.length);
  done(created + updated);
  await db.destroy();
}

main().catch((err) => {
  fail(`import:perks failed: ${(err as Error).message}`);
  console.error(err);
  process.exit(1);
});
