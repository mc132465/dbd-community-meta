/**
 * Bulk-import "For Noobs" explanations (and optionally official descriptions) for
 * perks and powers from a CSV, matched by slug.
 *
 *   pnpm import:noob                     # reads data/noob-explanations.csv
 *   pnpm import:noob path/to/file.csv
 *
 * CSV header (order-independent; description is optional):
 *   kind,slug,noob_explanation,description
 *   perk,sprint-burst,"When you stop running you sprint for a few seconds.",
 *   power,the-trapper,"Set bear traps on the ground to catch survivors.",
 *
 * kind ∈ perk | power. Rows whose slug isn't found are reported and skipped.
 * Read-mostly: only updates the matched rows. Safe to re-run (idempotent by slug).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createDb } from "../db/client";

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  const file = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : resolve(process.cwd(), "data", "noob-explanations.csv");

  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    console.error(`CSV not found: ${file}`);
    process.exit(1);
    return;
  }

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    console.error("CSV has no data rows.");
    process.exit(1);
    return;
  }
  const header = splitCsv(lines[0]).map((h) => h.trim().toLowerCase());
  const ki = header.indexOf("kind");
  const si = header.indexOf("slug");
  const ni = header.indexOf("noob_explanation");
  const di = header.indexOf("description");
  if (ki < 0 || si < 0 || ni < 0) {
    console.error("CSV needs at least: kind,slug,noob_explanation columns.");
    process.exit(1);
    return;
  }

  const db = createDb();
  let perkUpdated = 0;
  let powerUpdated = 0;
  const notFound: string[] = [];
  try {
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsv(lines[i]);
      const kind = (cells[ki] ?? "").trim().toLowerCase();
      const slug = (cells[si] ?? "").trim();
      const noob = (cells[ni] ?? "").trim();
      const desc = di >= 0 ? (cells[di] ?? "").trim() : "";
      if (!slug || !noob) continue;

      const table = kind === "power" ? "powers" : "perks";
      const set: Record<string, string> = { noob_explanation: noob };
      if (desc) set.description = desc;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table
      const res = await (db.updateTable(table as any) as any)
        .set(set)
        .where("slug", "=", slug)
        .executeTakeFirst();
      const changed = Number(res?.numUpdatedRows ?? 0) > 0;
      if (!changed) {
        notFound.push(`${kind}:${slug}`);
      } else if (table === "powers") {
        powerUpdated++;
      } else {
        perkUpdated++;
      }
    }
  } finally {
    await db.destroy();
  }

  console.log(`Perks updated:  ${perkUpdated}`);
  console.log(`Powers updated: ${powerUpdated}`);
  if (notFound.length > 0) {
    console.log(`\nNot found (${notFound.length}):`);
    for (const n of notFound) console.log(`  ${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
