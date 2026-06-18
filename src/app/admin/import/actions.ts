"use server";

import { execFile } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import AdmZip from "adm-zip";

import { requireStaff } from "@/lib/auth/authz";

const run = promisify(execFile);
const TSX = "node_modules/.bin/tsx";

export type ImportResult = { ok: boolean; output: string };

/** Fixed, non-parameterized import scripts (no user input in the command). */
const SCRIPTS = {
  game: ["scripts/import/index.ts"],
  characters: ["scripts/import-characters/index.ts"],
  powers: ["scripts/import-powers/index.ts"],
  tierlists: ["scripts/import-tierlists/index.ts"],
} as const;
export type ImportKind = keyof typeof SCRIPTS;

/** Pack/folder names must be simple slugs — prevents argument/path injection. */
function safeName(value: string): string | null {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value) ? value : null;
}

/** A `.zip` filename under data/assets (no path separators or traversal). */
function safeZip(value: string): string | null {
  if (value.includes("/") || value.includes("\\") || value.includes("..")) {
    return null;
  }
  return /^[a-z0-9][a-z0-9_.-]{0,80}\.zip$/i.test(value) ? value : null;
}

async function exec(args: string[]): Promise<ImportResult> {
  try {
    const { stdout, stderr } = await run(TSX, args, {
      cwd: process.cwd(),
      env: process.env,
      timeout: 1000 * 60 * 10, // 10 min ceiling
      maxBuffer: 1024 * 1024 * 16,
    });
    return { ok: true, output: `${stdout}\n${stderr}`.trim() || "Done." };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const out = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n");
    return { ok: false, output: out || "Import failed." };
  }
}

/** Run one of the fixed import scripts (game/characters/powers/tierlists). */
export async function runImportAction(kind: ImportKind): Promise<ImportResult> {
  await requireStaff();
  const script = SCRIPTS[kind];
  if (!script) return { ok: false, output: `Unknown import: ${kind}` };
  return exec([...script]);
}

/** Import (map) an already-organized asset pack: import:assets --pack=<slug>. */
export async function runAssetImportAction(pack: string): Promise<ImportResult> {
  await requireStaff();
  const p = safeName(pack);
  if (!p) return { ok: false, output: `Invalid pack name: ${pack}` };
  return exec(["scripts/import-assets/index.ts", `--pack=${p}`]);
}

/**
 * Import a whole pack from either a `.zip` file or a folder under data/assets/.
 * Robust end-to-end flow with no manual CLI paths:
 *   (zip) extract to a temp dir → auto-detect nested root → convert into
 *   data/assets/packs/<slug>/<category>/ → derive killer powers → map PNGs.
 * Safe to re-run; never throws on unmapped files (those stay listed in
 * Admin → Asset Packs for manual assignment).
 */
export async function runImportPackAction(
  src: string,
  pack: string,
): Promise<ImportResult> {
  await requireStaff();
  const p = safeName(pack);
  if (!p) return { ok: false, output: `Invalid pack name: ${pack}` };

  const cwd = process.cwd();
  const logs: string[] = [];
  let convertDir: string;
  let tmpExtract: string | null = null;

  if (/\.zip$/i.test(src)) {
    const z = safeZip(src);
    if (!z) return { ok: false, output: `Invalid zip name: ${src}` };
    tmpExtract = join(tmpdir(), `dbd-pack-${p}`);
    try {
      rmSync(tmpExtract, { recursive: true, force: true }); // clean re-run
      mkdirSync(tmpExtract, { recursive: true });
      new AdmZip(join(cwd, "data/assets", z)).extractAllTo(tmpExtract, true);
      logs.push(`Extracted ${z}`);
    } catch (err) {
      return { ok: false, output: `Failed to extract ${z}: ${String(err)}` };
    }
    convertDir = tmpExtract; // convert auto-detects the real root inside
  } else {
    const d = safeName(src);
    if (!d) return { ok: false, output: `Invalid folder name: ${src}` };
    convertDir = join(cwd, "data/assets", d);
  }

  // convert auto-detects nested roots (e.g. DBD_Icons_1/DBD_Icons_1) itself.
  const conv = await exec([
    "scripts/convert-old-assets/index.ts",
    `--in=${convertDir}`,
    `--pack=${p}`,
  ]);
  logs.push("== convert-old-assets ==", conv.output);
  if (!conv.ok) {
    if (tmpExtract) rmSync(tmpExtract, { recursive: true, force: true });
    return { ok: false, output: logs.join("\n\n") };
  }

  const powers = await exec(["scripts/import-powers/index.ts"]);
  logs.push("== import:powers ==", powers.output);

  const assets = await exec([
    "scripts/import-assets/index.ts",
    `--pack=${p}`,
  ]);
  logs.push("== import:assets ==", assets.output);

  if (tmpExtract) {
    try {
      rmSync(tmpExtract, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
  return { ok: assets.ok, output: logs.join("\n\n") };
}
