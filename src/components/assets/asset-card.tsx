import Link from "next/link";

import { cn } from "@/lib/utils";
import type { AddonRarity, GameRole } from "@/types/database";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import type { AssetCategory } from "@/lib/assets/resolve";

export function RoleBadge({ role }: { role: GameRole | null }) {
  if (!role) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        role === "killer"
          ? "bg-primary/15 text-primary"
          : "bg-secondary text-secondary-foreground",
      )}
    >
      {role}
    </span>
  );
}

const RARITY_LABEL: Record<AddonRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  very_rare: "Very rare",
  ultra_rare: "Ultra rare",
  event: "Event",
};

export function RarityBadge({ rarity }: { rarity: AddonRarity }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {RARITY_LABEL[rarity]}
    </span>
  );
}

type AssetCardProps = {
  href: string;
  name: string;
  subtitle?: string | null;
  imageUrl: string | null;
  badge?: React.ReactNode;
  category?: AssetCategory;
  slug?: string | null;
};

export function AssetCard({
  href,
  name,
  subtitle,
  imageUrl,
  badge,
  category,
  slug,
}: AssetCardProps) {
  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-lg border border-border/60 bg-card transition-colors hover:border-border"
    >
      <div className="aspect-square w-full overflow-hidden">
        <AssetThumb
          src={imageUrl}
          alt={name}
          fallbackLabel={initialsFrom(name)}
          category={category}
          slug={slug}
        />
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-display text-sm font-semibold uppercase tracking-wide">
            {name}
          </h3>
          {badge}
        </div>
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </Link>
  );
}
