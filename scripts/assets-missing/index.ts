import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { createDb } from "../db/client";

/**
 * Missing-assets report.
 *
 * Convention: every catalog image lives at
 *   public/assets/<category>/<slug>.png
 * This script lists, per category, the catalog slugs that have NO file on disk —
 * so you can see at a glance which PNGs are still missing. It only reports; it
 * never writes or maps anything.
 *
 *   pnpm assets:missing
 */

const PUBLIC_ASSETS = resolve(process.cwd(), "public/assets");

type Check = {
  category: string;
  table: "perks" | "characters" | "items" | "add_ons" | "maps" | "offerings" | "powers";
  role?: "killer" | "survivor";
};

const CHECKS: Check[] = [
  { category: "perks", table: "perks" },
  { category: "killers", table: "characters", role: "killer" },
  { category: "survivors", table: "characters", role: "survivor" },
  { category: "items", table: "items" },
  { category: "addons", table: "add_ons" },
  { category: "maps", table: "maps" },
  { category: "offerings", table: "offerings" },
  { category: "powers", table: "powers" },
];

async function main() {
  const db = createDb();
  let totalMissing = 0;
  let totalRows = 0;

  try {
    for (const check of CHECKS) {
      let q = db.selectFrom(check.table).select(["slug", "name"]);
      if (check.role) q = q.where("role", "=", check.role);
      const rows = await q.orderBy("name").execute();
      totalRows += rows.length;

      const missing = rows.filter(
        (r) => !existsSync(resolve(PUBLIC_ASSETS, check.category, `${r.slug}.png`)),
      );

      const have = rows.length - missing.length;
      console.log(
        `\n${check.category}: ${have}/${rows.length} present` +
          (missing.length ? ` — ${missing.length} missing:` : " — all present ✓"),
      );
      for (const r of missing) {
        console.log(`  - ${r.slug}  (${r.name})  → public/assets/${check.category}/${r.slug}.png`);
        totalMissing += 1;
      }
    }

    console.log(
      `\nSummary: ${totalRows - totalMissing}/${totalRows} catalog entries have an asset; ${totalMissing} missing.`,
    );
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
