/**
 * convert-old-assets — reorganize an older/flat asset pack into the new
 * multi-pack layout the importer expects:
 *
 *   data/assets/packs/<pack-slug>/<category>/*.png
 *   category ∈ perks, killers, survivors, characters, items, addons, maps,
 *              offerings, other
 *
 * It maps old top-level folders (any casing / separators) onto the new
 * categories, recursively collects image files, and copies (or moves) them in.
 * Unknown folders and loose top-level files land in `other/` so nothing is lost.
 * The image bytes are never modified — only relocated.
 *
 * Usage:
 *   pnpm convert-old-assets --in=data/assets/DBD_Icons --pack=dbd-icons-pack-1
 *   pnpm convert-old-assets --in=<dir> --pack=<slug> [--move] [--dry]
 *
 *   --in    source folder of the old pack (required)
 *   --pack  destination pack slug under data/assets/packs/ (required)
 *   --move  move files instead of copying (default: copy)
 *   --dry   print what would happen without writing anything
 */

import { promises as fs, type Dirent } from "fs";
import { basename, extname, join, parse, relative, resolve, sep } from "path";

const NEW_CATEGORIES = [
  "perks",
  "killers",
  "survivors",
  "characters",
  "items",
  "addons",
  "maps",
  "offerings",
  "powers",
  "other",
] as const;
type Category = (typeof NEW_CATEGORIES)[number];

const IMAGE_EXT = new Set([".png", ".webp", ".jpg", ".jpeg", ".gif"]);

/** Normalize a folder name: lowercase, strip separators/punctuation. */
function norm(name: string): string {
  return name.toLowerCase().replace(/[\s_\-.]+/g, "");
}

/** Map a (normalized) old folder name to a new category. */
function mapFolder(folder: string): Category {
  const n = norm(folder);
  const table: Record<string, Category> = {
    perks: "perks",
    perk: "perks",
    items: "items",
    item: "items",
    itemaddons: "addons",
    itemaddon: "addons",
    addons: "addons",
    addon: "addons",
    offerings: "offerings",
    offering: "offerings",
    killers: "killers",
    killer: "killers",
    survivors: "survivors",
    survivor: "survivors",
    characters: "characters",
    character: "characters",
    portraits: "characters",
    charportraits: "characters",
    charportrait: "characters",
    favors: "offerings",
    favor: "offerings",
    maps: "maps",
    map: "maps",
    realms: "maps",
    realm: "maps",
    // Killer powers are a first-class category (the powers table).
    killerpowers: "powers",
    killerpower: "powers",
    powers: "powers",
    power: "powers",
    statuseffects: "other",
    statuseffect: "other",
    status: "other",
  };
  return table[n] ?? "other";
}

type Args = { in?: string; pack?: string; move: boolean; dry: boolean };

function parseArgs(argv: string[]): Args {
  const out: Args = { move: false, dry: false };
  for (const a of argv) {
    if (a.startsWith("--in=")) out.in = a.slice("--in=".length);
    else if (a.startsWith("--pack=")) out.pack = a.slice("--pack=".length);
    else if (a === "--move") out.move = true;
    else if (a === "--dry") out.dry = true;
  }
  return out;
}

/** Recursively collect image file paths under a directory. */
async function collectImages(dir: string): Promise<string[]> {
  const found: string[] = [];
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectImages(full)));
    } else if (IMAGE_EXT.has(extname(entry.name).toLowerCase())) {
      found.push(full);
    }
  }
  return found;
}

/** Pick a non-colliding destination filename within a category dir. */
function uniqueName(used: Set<string>, file: string): string {
  const { name, ext } = parse(basename(file));
  let candidate = `${name}${ext}`;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${name}-${i}${ext}`;
    i++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Output filename from an explicit manifest slug (deduped, keeps source ext). */
function uniqueSlugName(used: Set<string>, slug: string, src: string): string {
  const ext = extname(src).toLowerCase() || ".png";
  let candidate = `${slug}${ext}`;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${slug}-${i}${ext}`;
    i++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Minimal CSV splitter handling quoted cells. */
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

type ManifestEntry = { category: Category; slug: string };

/**
 * Load an optional manifest.json or manifest.csv from the pack root. It maps a
 * file (path or basename) to a category + target slug, overriding folder/​name
 * guessing. JSON: array of {file, category, slug}. CSV: header file,category,slug.
 * Keyed by normalized relative path and by `base:<basename>` for forgiving match.
 */
async function loadManifest(
  root: string,
): Promise<Map<string, ManifestEntry> | null> {
  for (const fname of ["manifest.json", "manifest.csv"]) {
    let raw: string;
    try {
      raw = await fs.readFile(join(root, fname), "utf8");
    } catch {
      continue;
    }
    const rows: { file: string; category: string; slug: string }[] = [];
    if (fname.endsWith(".json")) {
      try {
        const data = JSON.parse(raw);
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.entries)
            ? data.entries
            : [];
        for (const e of arr) {
          const file = String(e.file ?? e.path ?? "").trim();
          const category = String(e.category ?? e.type ?? "").trim();
          const slug = String(e.slug ?? e.target ?? "").trim();
          if (file && category && slug) rows.push({ file, category, slug });
        }
      } catch (err) {
        console.warn(`Manifest parse error (${fname}): ${(err as Error).message}`);
        return null;
      }
    } else {
      const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return null;
      const header = splitCsv(lines[0]).map((h) => h.trim().toLowerCase());
      const fi = header.indexOf("file");
      const ci = header.indexOf("category");
      const si = header.indexOf("slug");
      if (fi < 0 || ci < 0 || si < 0) {
        console.warn("Manifest CSV needs file,category,slug columns.");
        return null;
      }
      for (let i = 1; i < lines.length; i++) {
        const cells = splitCsv(lines[i]);
        const file = (cells[fi] ?? "").trim();
        const category = (cells[ci] ?? "").trim();
        const slug = (cells[si] ?? "").trim();
        if (file && category && slug) rows.push({ file, category, slug });
      }
    }

    const map = new Map<string, ManifestEntry>();
    for (const r of rows) {
      const category = mapFolder(r.category);
      const entry: ManifestEntry = { category, slug: r.slug };
      const relKey = r.file.replace(/\\/g, "/").replace(/^\.?\//, "");
      map.set(relKey, entry);
      map.set(`base:${basename(relKey).toLowerCase()}`, entry);
    }
    console.log(`Manifest loaded (${fname}): ${rows.length} entries.`);
    return map.size ? map : null;
  }
  return null;
}

/**
 * Auto-detect the real pack root. Unwraps redundant wrapper folders such as
 * `DBD_Icons_1/DBD_Icons_1/...` by descending while the directory holds a single
 * subfolder and has no images and no recognized category folders of its own.
 */
async function resolveRoot(dir: string): Promise<string> {
  for (let depth = 0; depth < 10; depth++) {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return dir;
    }
    const subdirs = entries.filter((e) => e.isDirectory());
    const hasImages = entries.some(
      (e) => e.isFile() && IMAGE_EXT.has(extname(e.name).toLowerCase()),
    );
    const hasRecognized = subdirs.some((d) => mapFolder(d.name) !== "other");
    if (hasImages || hasRecognized) return dir; // real root reached
    if (subdirs.length === 1) {
      dir = join(dir, subdirs[0].name); // unwrap one wrapper folder, descend
      continue;
    }
    return dir; // nothing recognizable to unwrap
  }
  return dir;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.in || !args.pack) {
    console.error(
      "Usage: pnpm convert-old-assets --in=<old-folder> --pack=<slug> [--move] [--dry]",
    );
    process.exit(1);
    return;
  }

  const inputRoot = resolve(process.cwd(), args.in);
  const srcRoot = await resolveRoot(inputRoot);
  if (srcRoot !== inputRoot) {
    console.log(`Auto-detected pack root: ${srcRoot}`);
  }
  const destRoot = resolve(process.cwd(), "data/assets/packs", args.pack);

  const allImages = await collectImages(srcRoot);
  if (allImages.length === 0) {
    console.error(`No image files found under: ${srcRoot}`);
    process.exit(1);
    return;
  }

  const manifest = await loadManifest(srcRoot);

  // Plan: category -> [{ src, slug? }]. A manifest entry sets an explicit output
  // slug + category (overriding folder guessing); otherwise the first path
  // segment's folder name decides the category.
  const plan = new Map<Category, { src: string; slug?: string }[]>();
  for (const c of NEW_CATEGORIES) plan.set(c, []);
  let manifestHits = 0;

  for (const img of allImages) {
    const rel = relative(srcRoot, img).split(sep).join("/").replace(/^\.?\//, "");
    const m = manifest
      ? (manifest.get(rel) ?? manifest.get(`base:${basename(img).toLowerCase()}`))
      : undefined;
    if (m) {
      plan.get(m.category)!.push({ src: img, slug: m.slug });
      manifestHits++;
    } else {
      const top = rel.includes("/") ? rel.split("/")[0] : "";
      const category = top ? mapFolder(top) : "other";
      plan.get(category)!.push({ src: img });
    }
  }

  console.log(`\nConverting "${args.in}" → data/assets/packs/${args.pack}/`);
  console.log(args.dry ? "(dry run — no files written)\n" : "");
  if (manifest) {
    console.log(
      `Manifest: ${manifestHits}/${allImages.length} file(s) mapped explicitly.`,
    );
  }
  for (const category of NEW_CATEGORIES) {
    const n = plan.get(category)!.length;
    if (n > 0) console.log(`  ${category}/   ${n} file(s)`);
  }

  let total = 0;
  for (const category of NEW_CATEGORIES) {
    const files = plan.get(category)!;
    if (files.length === 0) continue;
    const destDir = join(destRoot, category);
    if (!args.dry) await fs.mkdir(destDir, { recursive: true });
    const used = new Set<string>();
    for (const { src, slug } of files) {
      const name = slug ? uniqueSlugName(used, slug, src) : uniqueName(used, src);
      const dest = join(destDir, name);
      if (!args.dry) {
        if (args.move) await fs.rename(src, dest);
        else await fs.copyFile(src, dest);
      }
      total++;
    }
  }

  console.log(`\nDone. ${total} image(s) ${args.dry ? "planned" : args.move ? "moved" : "copied"}.`);
  console.log(`Next: pnpm import:assets --pack=${args.pack}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
