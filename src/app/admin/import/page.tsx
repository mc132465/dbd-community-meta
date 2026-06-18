import type { Metadata } from "next";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { ImportRunner } from "@/components/admin/import-runner";

export const metadata: Metadata = { title: "Import · Admin" };

/** List immediate subdirectories of a path under the project root (safe). */
function subdirs(rel: string): string[] {
  try {
    return readdirSync(resolve(process.cwd(), rel), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/** List files matching an extension under a path (safe). */
function files(rel: string, ext: string): string[] {
  try {
    return readdirSync(resolve(process.cwd(), rel), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(ext))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

export default function AdminImportPage() {
  const packs = subdirs("data/assets/packs");
  // Importable sources: raw icon folders + uploaded ZIPs under data/assets/.
  const rawDirs = subdirs("data/assets").filter(
    (d) => d !== "packs" && !d.startsWith("."),
  );
  const zips = files("data/assets", ".zip");
  const sources = [...zips, ...rawDirs];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">
          Import
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload or select an asset ZIP/folder and import it automatically — no
          shell or Docker paths required. Equivalent to the{" "}
          <code>pnpm import:*</code> commands.
        </p>
      </header>
      <ImportRunner packs={packs} sources={sources} />
    </div>
  );
}
