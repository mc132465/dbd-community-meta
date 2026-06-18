/* Accumulates and prints the asset import report. */

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  bold: "\x1b[1m",
};

export type CategoryReport = {
  category: string;
  scanned: number;
  imported: number;
  skipped: number;
  duplicates: number;
  unmatched: number;
  mapped: number;
  unmapped: number;
  created: number;
  updated: number;
};

export function newCategoryReport(category: string): CategoryReport {
  return {
    category,
    scanned: 0,
    imported: 0,
    skipped: 0,
    duplicates: 0,
    unmatched: 0,
    mapped: 0,
    unmapped: 0,
    created: 0,
    updated: 0,
  };
}

export class ImportReport {
  categories: CategoryReport[] = [];
  problems: { category: string; file: string; reason: string }[] = [];

  add(report: CategoryReport): void {
    this.categories.push(report);
  }

  problem(category: string, file: string, reason: string): void {
    this.problems.push({ category, file, reason });
  }

  private totals() {
    return this.categories.reduce(
      (acc, r) => ({
        scanned: acc.scanned + r.scanned,
        imported: acc.imported + r.imported,
        skipped: acc.skipped + r.skipped,
        duplicates: acc.duplicates + r.duplicates,
        unmatched: acc.unmatched + r.unmatched,
        mapped: acc.mapped + r.mapped,
        unmapped: acc.unmapped + r.unmapped,
        created: acc.created + r.created,
        updated: acc.updated + r.updated,
      }),
      {
        scanned: 0,
        imported: 0,
        skipped: 0,
        duplicates: 0,
        unmatched: 0,
        mapped: 0,
        unmapped: 0,
        created: 0,
        updated: 0,
      },
    );
  }

  print(): void {
    console.log(`\n${c.bold}=== Asset Import Report ===${c.reset}`);
    for (const r of this.categories) {
      console.log(
        `\n${c.cyan}${r.category}${c.reset}\n` +
          `  scanned ${r.scanned} · imported ${c.green}${r.imported}${c.reset} · ` +
          `created ${r.created} · updated ${r.updated} · ` +
          `mapped ${c.green}${r.mapped}${c.reset} · unmapped ${c.yellow}${r.unmapped}${c.reset} · ` +
          `skipped ${r.skipped} · duplicates ${r.duplicates} · ` +
          `${r.unmatched ? c.yellow : ""}unmatched ${r.unmatched}${c.reset}`,
      );
    }

    const t = this.totals();
    console.log(`\n${c.bold}Totals${c.reset}`);
    console.log(`  total files scanned   : ${t.scanned}`);
    console.log(`  imported assets       : ${c.green}${t.imported}${c.reset}`);
    console.log(`  mapped (assigned)     : ${c.green}${t.mapped}${c.reset}`);
    console.log(`  unmapped (tracked)    : ${c.yellow}${t.unmapped}${c.reset}`);
    console.log(`  created db records    : ${t.created}`);
    console.log(`  updated db records    : ${t.updated}`);
    console.log(`  skipped assets        : ${t.skipped}`);
    console.log(`  duplicate assets      : ${t.duplicates}`);
    console.log(
      `  unmatched/problematic : ${t.unmatched ? c.yellow : ""}${t.unmatched}${c.reset}`,
    );

    if (this.problems.length > 0) {
      console.log(`\n${c.yellow}Problematic files:${c.reset}`);
      for (const p of this.problems.slice(0, 100)) {
        console.log(`  ${c.dim}[${p.category}]${c.reset} ${p.file} — ${p.reason}`);
      }
      if (this.problems.length > 100) {
        console.log(`  …and ${this.problems.length - 100} more`);
      }
    }
  }
}
