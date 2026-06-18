import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { BackupImport } from "@/components/admin/backup-import";

export const metadata: Metadata = { title: "Backup · Admin" };

const EXPORTS: { scope: string; label: string; desc: string }[] = [
  {
    scope: "settings",
    label: "Settings only",
    desc: "Theme, site texts, and maintenance — everything in site_settings.",
  },
  {
    scope: "assets",
    label: "Asset metadata only",
    desc: "Asset packs and image mappings (metadata, not the image files).",
  },
  {
    scope: "all",
    label: "Everything",
    desc: "Settings + asset metadata in a single file.",
  },
];

export default function BackupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Backup
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Export a portable JSON snapshot you can keep safe. This is read-only —
          nothing is changed. Import will be added next.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {EXPORTS.map((e) => (
          <div
            key={e.scope}
            className="flex flex-col gap-3 rounded-lg border border-border/60 p-4"
          >
            <div className="flex-1">
              <p className="font-medium">{e.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{e.desc}</p>
            </div>
            <Button asChild>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler, not a page; needs a real GET for file download */}
              <a href={`/admin/backup/download?scope=${e.scope}`} download>
                Download .json
              </a>
            </Button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Asset export contains metadata only — image files are not included. To
        move images between machines, copy the pack folders and run{" "}
        <code className="rounded bg-muted px-1 py-0.5">pnpm import:assets</code>.
      </p>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <div>
          <h3 className="font-display text-lg font-semibold uppercase tracking-wide">
            Import (preview)
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a backup file to see exactly what would change. This is a dry
            run — nothing is written yet.
          </p>
        </div>
        <BackupImport />
      </section>
    </div>
  );
}
