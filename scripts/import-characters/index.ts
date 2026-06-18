import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createDb } from "../db/client";
import { upsertByKey } from "../import/upsert";
import { done, fail, ok, step, warn } from "../import/log";

const SOURCE = "dbd-catalog-seed";

type PerkSeed = { name: string; slug: string };
type CharacterSeed = {
  role: "killer" | "survivor";
  name: string;
  slug: string;
  chapter?: string;
  description?: string;
  power_name?: string;
  power_desc?: string;
  needs_verification?: boolean;
  perks?: PerkSeed[];
};

function loadCatalog(): CharacterSeed[] {
  const raw = readFileSync(
    resolve(process.cwd(), "data/characters/catalog.json"),
    "utf-8",
  );
  const parsed = JSON.parse(raw) as { characters?: CharacterSeed[] };
  if (!Array.isArray(parsed.characters)) {
    throw new Error("catalog.json must have a `characters` array.");
  }
  return parsed.characters;
}

async function main() {
  const db = createDb();
  const characters = loadCatalog();

  // 1. Upsert characters (by slug) -------------------------------------------
  step(`Importing ${characters.length} characters`);
  const characterRows = characters.map((c) => ({
    role: c.role,
    name: c.name,
    slug: c.slug,
    chapter: c.chapter ?? null,
    description: c.description ?? null,
    power_name: c.power_name ?? null,
    power_desc: c.power_desc ?? null,
    source: SOURCE,
    // image_url intentionally omitted → stays null / preserved if already set.
  }));
  const characterBySlug = await upsertByKey(db, "characters", characterRows);
  ok("characters", characterRows.length);

  // 2. Upsert unique perks, linked to their origin character -----------------
  const perkRows: Record<string, unknown>[] = [];
  const seenPerkSlugs = new Set<string>();
  let duplicatePerks = 0;

  for (const c of characters) {
    const charId = characterBySlug.get(c.slug);
    if (!charId) continue;
    for (const perk of c.perks ?? []) {
      if (seenPerkSlugs.has(perk.slug)) {
        duplicatePerks += 1;
        warn(`Duplicate perk slug "${perk.slug}" (skipped)`);
        continue;
      }
      seenPerkSlugs.add(perk.slug);
      perkRows.push({
        role: c.role,
        name: perk.name,
        slug: perk.slug,
        origin_character_id: charId,
        is_teachable: true,
        source: SOURCE,
        // icon_url omitted → preserves any icon set by `import:assets`.
      });
    }
  }

  step(`Linking ${perkRows.length} unique perks to origin characters`);
  await upsertByKey(db, "perks", perkRows);
  ok("perks", perkRows.length);

  // 3. Report ----------------------------------------------------------------
  const flagged = characters.filter((c) => c.needs_verification);
  const noPerks = characters.filter((c) => !c.perks || c.perks.length === 0);

  console.log("\n=== Character Catalog Report ===");
  console.log(`  characters upserted     : ${characterRows.length}`);
  console.log(
    `    killers               : ${characters.filter((c) => c.role === "killer").length}`,
  );
  console.log(
    `    survivors             : ${characters.filter((c) => c.role === "survivor").length}`,
  );
  console.log(`  unique perks linked     : ${perkRows.length}`);
  console.log(`  duplicate perks skipped : ${duplicatePerks}`);
  console.log(`  NEEDS VERIFICATION      : ${flagged.length}`);
  if (flagged.length > 0) {
    console.log(
      `    ${flagged.map((c) => c.name).join(", ")}`,
    );
  }
  if (noPerks.length > 0) {
    console.log(`  characters with no perks (verify): ${noPerks.length}`);
    console.log(`    ${noPerks.map((c) => c.name).join(", ")}`);
  }

  done(characterRows.length + perkRows.length);
  await db.destroy();
}

main().catch((error) => {
  fail((error as Error).message);
  process.exit(1);
});
