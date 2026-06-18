import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createDb } from "../db/client";
import { done, fail, ok, step, warn } from "../import/log";

const SOURCE = "otzdarva-tier-list";
const TIERS = ["S", "A", "B", "C", "D", "F"] as const;
type Tier = (typeof TIERS)[number];

type TierListSeed = {
  title: string;
  slug: string;
  description?: string;
  is_official?: boolean;
  source?: string;
  aliases?: Record<string, string>;
  tiers: Record<string, string[]>;
};

/** Canonical slug derivation — must match the perk seed / character importer. */
function normSlug(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadSeed(): TierListSeed {
  const raw = readFileSync(
    resolve(process.cwd(), "data/tier-lists/otzdarva-killer.json"),
    "utf-8",
  );
  const parsed = JSON.parse(raw) as TierListSeed;
  if (!parsed.slug || !parsed.tiers) {
    throw new Error("otzdarva-killer.json must have `slug` and `tiers`.");
  }
  return parsed;
}

async function main() {
  const db = createDb();
  const seed = loadSeed();
  const aliases = seed.aliases ?? {};

  // Build the perk lookup from canonical records (slug + normalized name).
  const perkRows = await db
    .selectFrom("perks")
    .select(["id", "slug", "name"])
    .execute();
  const bySlug = new Map<string, string>();
  const byNormName = new Map<string, string>();
  for (const p of perkRows) {
    bySlug.set(p.slug, p.id);
    byNormName.set(normSlug(p.name), p.id);
  }

  /** Resolve a tier-list display name to a perk id, or null. */
  function resolvePerk(name: string): string | null {
    const canonical = aliases[name] ?? name;
    const slug = normSlug(canonical);
    return bySlug.get(slug) ?? byNormName.get(slug) ?? null;
  }

  // 1. Upsert the tier list (by slug) ----------------------------------------
  step(`Importing tier list "${seed.title}"`);
  const now = new Date().toISOString();
  const listRow = (await db
    .insertInto("tier_lists")
    .values({
      title: seed.title,
      slug: seed.slug,
      description: seed.description ?? null,
      is_official: seed.is_official ?? true,
      source: seed.source ?? SOURCE,
      status: "published",
      published_at: now,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.column("slug").doUpdateSet({
        title: seed.title,
        description: seed.description ?? null,
        is_official: seed.is_official ?? true,
        source: seed.source ?? SOURCE,
        status: "published",
        published_at: now,
        updated_at: now,
      }),
    )
    .returning(["id"])
    .executeTakeFirstOrThrow()) as { id: string };
  const tierListId = listRow.id;

  // 2. Resolve entries; collect unmatched -------------------------------------
  const entries: { tier_list_id: string; perk_id: string; tier: Tier; position: number }[] = [];
  const unmatched: { tier: string; name: string }[] = [];
  const seenPerk = new Set<string>();
  let total = 0;

  for (const tier of TIERS) {
    const names = seed.tiers[tier] ?? [];
    let position = 0;
    for (const name of names) {
      total += 1;
      const perkId = resolvePerk(name);
      if (!perkId) {
        unmatched.push({ tier, name });
        continue;
      }
      if (seenPerk.has(perkId)) {
        warn(`Duplicate perk across tiers: "${name}" (kept first placement)`);
        continue;
      }
      seenPerk.add(perkId);
      entries.push({ tier_list_id: tierListId, perk_id: perkId, tier, position });
      position += 1;
    }
  }

  // 3. Replace this list's entries idempotently -------------------------------
  await db
    .deleteFrom("tier_list_entries")
    .where("tier_list_id", "=", tierListId)
    .execute();
  if (entries.length > 0) {
    await db.insertInto("tier_list_entries").values(entries).execute();
  }
  ok("tier_list_entries", entries.length);

  // 4. Coverage report --------------------------------------------------------
  const matched = entries.length;
  step(
    `Coverage: ${matched}/${total} names resolved (${unmatched.length} unmatched).`,
  );
  if (unmatched.length > 0) {
    warn("Unmatched names (no perk record — not created):");
    for (const u of unmatched) {
      console.log(`    [${u.tier}] ${u.name}`);
    }
    warn(
      "These are real DBD perks absent from the canonical perk data (newer/character perks). Add them to the perk catalog/seed to include them.",
    );
  }

  done(matched);
  await db.destroy();
}

main().catch((err) => {
  fail(`import:tierlists failed: ${(err as Error).message}`);
  console.error(err);
  process.exit(1);
});
