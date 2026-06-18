/**
 * import:powers — derive first-class Killer Power rows from the killer catalog.
 *
 * Each killer (characters.role = 'killer') with a power_name gets exactly one
 * row in the `powers` table, linked by character_id. The power slug is derived
 * from power_name with the same rule the app uses, so the asset importer can
 * match Killer_Powers icons to powers.slug automatically.
 *
 * Idempotent: upserts by slug and never touches icon_url, so re-running (or
 * running after import:assets) preserves icons already mapped by the importer.
 * Uses a plain pg Pool (cannot import the app's server-only modules from tsx).
 *
 *   pnpm import:powers
 *
 * Run AFTER import:characters / import:game (so power_name is populated) and
 * BEFORE import:assets (so power rows exist for icon matching).
 */
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "Missing DATABASE_URL in .env.local, e.g.\n" +
      "  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dbd",
  );
  process.exit(1);
}

/** Mirror of src/lib/builds/constants.ts slugify (kept in sync intentionally). */
function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "power"
  );
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    const killers = await client.query<{
      id: string;
      power_name: string | null;
      power_desc: string | null;
    }>(
      `select id, power_name, power_desc
         from public.characters
        where role = 'killer'
          and power_name is not null
          and btrim(power_name) <> ''`,
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const seenSlugs = new Set<string>();

    // Produce a slug not already used by a DIFFERENT killer's power row.
    async function uniqueSlug(name: string, charId: string): Promise<string> {
      const base = slugify(name);
      let slug = base;
      if (seenSlugs.has(slug)) slug = `${base}-${charId.slice(0, 8)}`;
      const taken = await client.query(
        `select 1 from public.powers
          where slug = $1 and character_id is distinct from $2 limit 1`,
        [slug, charId],
      );
      if ((taken.rowCount ?? 0) > 0) slug = `${base}-${charId.slice(0, 8)}`;
      seenSlugs.add(slug);
      return slug;
    }

    for (const k of killers.rows) {
      const name = (k.power_name ?? "").trim();
      if (!name) continue;
      try {
        const slug = await uniqueSlug(name, k.id);
        // One power per killer (powers_one_per_killer unique on character_id):
        // update the existing row if present, otherwise insert. icon_url is never
        // touched, so any icon already mapped by import:assets is preserved.
        const existing = await client.query(
          `select id from public.powers where character_id = $1 limit 1`,
          [k.id],
        );
        if ((existing.rowCount ?? 0) > 0) {
          await client.query(
            `update public.powers
                set name = $1, slug = $2, description = $3
              where character_id = $4`,
            [name, slug, k.power_desc, k.id],
          );
          updated += 1;
        } else {
          await client.query(
            `insert into public.powers (name, slug, description, character_id, source)
               values ($1, $2, $3, $4, 'derived:characters')`,
            [name, slug, k.power_desc, k.id],
          );
          created += 1;
        }
      } catch (err) {
        // Never abort the whole import for one bad row — skip and warn.
        skipped += 1;
        console.warn(`  WARN: could not derive power for character ${k.id}:`, err);
      }
    }

    console.log(
      `✓ Killer powers derived — ${created} created, ${updated} updated, ` +
        `${skipped} skipped, ${killers.rows.length} killers with a power_name.`,
    );
    if (killers.rows.length === 0) {
      console.log(
        "  (No killers have power_name yet. Populate power_name in the character " +
          "catalog data, or assign power icons manually in Admin → Asset Packs.)",
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ import:powers failed:\n", err);
  process.exit(1);
});
