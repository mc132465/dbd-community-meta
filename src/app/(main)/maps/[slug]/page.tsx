import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getMapBySlug } from "@/lib/services/assets.service";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const map = await getMapBySlug(params.slug);
  if (!map) return { title: "Map not found" };
  return { title: map.name };
}

export default async function MapDetailPage({ params }: Params) {
  const map = await getMapBySlug(params.slug);
  if (!map) notFound();

  return (
    <div className="container max-w-3xl py-12">
      <Link
        href="/maps"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All maps
      </Link>

      <div className="mt-6 aspect-video w-full overflow-hidden rounded-lg border border-border/60">
        <AssetThumb
          src={map.image_url}
          alt={map.name}
          fallbackLabel={initialsFrom(map.name)}
        />
      </div>

      <h1 className="mt-6 font-display text-3xl font-bold uppercase tracking-tight">
        {map.name}
      </h1>
      {map.realm ? (
        <p className="mt-2 text-muted-foreground">Realm: {map.realm}</p>
      ) : null}
    </div>
  );
}
