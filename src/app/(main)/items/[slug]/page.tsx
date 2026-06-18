import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getItemBySlug } from "@/lib/services/assets.service";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = await getItemBySlug(params.slug);
  if (!item) return { title: "Item not found" };
  return { title: item.name };
}

export default async function ItemDetailPage({ params }: Params) {
  const item = await getItemBySlug(params.slug);
  if (!item) notFound();

  return (
    <div className="container max-w-2xl py-12">
      <Link
        href="/items"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All items
      </Link>

      <div className="mt-6 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-border/60">
          <AssetThumb
            src={item.icon_url}
            alt={item.name}
            fallbackLabel={initialsFrom(item.name)}
          />
        </div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            {item.name}
          </h1>
          {item.category ? (
            <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
              {item.category}
            </span>
          ) : null}
        </div>
      </div>

      {item.description ? (
        <p className="mt-6 whitespace-pre-line text-muted-foreground">
          {item.description}
        </p>
      ) : null}
    </div>
  );
}
