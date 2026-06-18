import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getAddOnBySlug } from "@/lib/services/assets.service";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const addOn = await getAddOnBySlug(params.slug);
  if (!addOn) return { title: "Add-on not found" };
  return { title: addOn.name };
}

export default async function AddOnDetailPage({ params }: Params) {
  const addOn = await getAddOnBySlug(params.slug);
  if (!addOn) notFound();

  return (
    <div className="container max-w-2xl py-12">
      <Link
        href="/add-ons"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All add-ons
      </Link>

      <div className="mt-6 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-border/60">
          <AssetThumb
            src={addOn.icon_url}
            alt={addOn.name}
            fallbackLabel={initialsFrom(addOn.name)}
          />
        </div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            {addOn.name}
          </h1>
          {addOn.rarity ? (
            <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
              {addOn.rarity}
            </span>
          ) : null}
        </div>
      </div>

      {addOn.applies_to ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Applies to: <span className="capitalize">{addOn.applies_to}</span>
        </p>
      ) : null}

      {addOn.description ? (
        <p className="mt-6 whitespace-pre-line text-muted-foreground">
          {addOn.description}
        </p>
      ) : null}
    </div>
  );
}
