/**
 * Export every valid catalog target (category, slug, display name, id) so a
 * manifest can be built/validated against real data.
 *
 *   pnpm slugs:export
 *   docker compose exec web pnpm slugs:export
 *
 * Writes data/catalog-slugs.csv and data/catalog-slugs.json (bind-mounted) and
 * prints a per-category count. Read-only.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createDb } from "../db/client";

type Db = ReturnType<typeof createDb>;

type Cat = {
  category: string;
  table: "perks" | "characters" | "items" | "add_ons" | "maps" | "offerings" | "powers";
  role: "killer" | "survivor" | null;
};

const CATS: Cat[] = [
  { category: "perks", table: "perks", role: null },
  { category: "killers", table: "characters", role: "killer" },
  { category: "survivors", table: "characters", role: "survivor" },
  { category: "items", table: "items", role: null },
  { category: "add_ons", table: "add_ons", role: null },
  { category: "maps", table: "maps", role: null },
  { category: "offerings", table: "offerings", role: null },
  { category: "powers", table: "powers", role: null },
];

type Entry = { category: string; slug: string; name: string; id: string };

async function load(db: Db, cat: Cat): Promise<Entry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table
  let q = (db.selectFrom(cat.table as any) as any).select(["id", "slug", "name"]);
  if (cat.role) q = q.where("role", "=", cat.role);
  const rows = (await q.execute()) as { id: string; slug: string; name: string }[];
  return rows
    .filter((r) => r.slug)
    .map((r) => ({ category: cat.category, slug: r.slug, name: r.name, id: r.id }));
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function main() {
  const db = createDb();
  try {
    const all: Entry[] = [];
    for (const cat of CATS) all.push(...(await load(db, cat)));

    const header = "category,slug,name,id";
    const csv = [
      header,
      ...all.map(
        (e) => `${csvCell(e.category)},${csvCell(e.slug)},${csvCell(e.name)},${csvCell(e.id)}`,
      ),
    ].join("\n");

    const csvPath = resolve(process.cwd(), "data", "catalog-slugs.csv");
    const jsonPath = resolve(process.cwd(), "data", "catalog-slugs.json");
    writeFileSync(csvPath, csv);
    writeFileSync(jsonPath, JSON.stringify(all, null, 2));

    const byCat = new Map<string, number>();
    for (const e of all) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
    console.log("Catalog targets exported:");
    for (const [c, n] of byCat) console.log(`  ${c}: ${n}`);
    console.log(`\nWrote ${csvPath}`);
    console.log(`Wrote ${jsonPath}`);
    console.log(
      "\nBuild a manifest.csv (file,category,slug) using these slugs, place it at " +
        "the ZIP root, and the importer will map by it exactly.",
    );
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
