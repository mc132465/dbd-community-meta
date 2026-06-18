import Link from "next/link";

import { ASSET_TYPES, assetConfigs } from "@/lib/admin/asset-config";
import { getAssetCounts } from "@/lib/services/assets.service";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminAssetsPage() {
  const counts = await getAssetCounts();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Assets
        </h2>
        <p className="text-sm text-muted-foreground">
          Create and edit game content. Seed sample data with{" "}
          <code className="rounded bg-muted px-1">pnpm import:game</code>.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border/60 bg-card p-4 text-sm">
        <p className="font-medium">How the asset system fits together</p>
        <ul className="space-y-1 text-muted-foreground">
          <li>
            <strong className="text-foreground">Assets</strong> (this page) — the
            catalog entities themselves (perks, characters, items, add-ons, maps).
            Edit their details and image URL here.
          </li>
          <li>
            <strong className="text-foreground">Asset Packs</strong> — an imported
            set of image files. Review a pack and fix individual mappings (assign an
            image to an entity, or reset to automatic).
          </li>
          <li>
            <strong className="text-foreground">Mapping</strong> — a read-only
            overview: which imported images are mapped to which entities, with
            coverage stats. Run <code className="rounded bg-muted px-1">pnpm diagnose:assets</code> for the full report.
          </li>
          <li>
            <strong className="text-foreground">Import</strong> — upload a ZIP, then
            convert + import it. With a <code className="rounded bg-muted px-1">manifest.csv</code>{" "}
            in the ZIP (file, category, slug) mapping is exact; otherwise files are
            matched by folder + filename. Build the manifest against{" "}
            <code className="rounded bg-muted px-1">pnpm slugs:export</code>.
          </li>
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ASSET_TYPES.map((type) => (
          <Link key={type} href={`/admin/assets/${type}`}>
            <Card className="transition-colors hover:border-border">
              <CardHeader>
                <CardTitle className="text-base">
                  {assetConfigs[type].labelPlural}
                </CardTitle>
                <CardDescription>{counts[type] ?? 0} records</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
