import type { Metadata } from "next";

import { listMaps } from "@/lib/services/assets.service";
import { AssetCard } from "@/components/assets/asset-card";

export const metadata: Metadata = {
  title: "Maps",
  description: "Trial maps and realms.",
};

export default async function MapsPage() {
  const maps = await listMaps();

  return (
    <div className="container space-y-6 py-12">
      <header>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Maps
        </h1>
        <p className="mt-2 text-muted-foreground">
          Sample data — images arrive with real datasets.
        </p>
      </header>

      {maps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No maps yet. Run the importer (`pnpm import:game`).
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {maps.map((m) => (
            <AssetCard
              key={m.id}
              href={`/maps/${m.slug}`}
              name={m.name}
              subtitle={m.realm}
              imageUrl={m.image_url}
            />
          ))}
        </div>
      )}
    </div>
  );
}
