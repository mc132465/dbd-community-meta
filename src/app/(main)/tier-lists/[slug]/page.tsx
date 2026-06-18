import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getTierListBySlug } from "@/lib/services/tierlists.service";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import { OfficialBadge } from "@/components/builds/badges";
import { deleteTierListFromDetailAction } from "../actions";
import type { TierRank } from "@/types/database";

type Params = { params: { slug: string } };

export async function generateMetadata({
  params,
}: Params): Promise<Metadata> {
  const list = await getTierListBySlug(params.slug);
  if (!list) return { title: "Tier List" };
  return { title: list.title, description: list.description ?? undefined };
}

/** Strong, saturated tier accents (S red → F gray). */
const TIER_STYLE: Record<TierRank, { label: string; chip: string; edge: string }> = {
  S: { label: "S", chip: "bg-tier-s text-white", edge: "border-l-tier-s" },
  A: { label: "A", chip: "bg-tier-a text-white", edge: "border-l-tier-a" },
  B: { label: "B", chip: "bg-tier-b text-white", edge: "border-l-tier-b" },
  C: { label: "C", chip: "bg-tier-c text-white", edge: "border-l-tier-c" },
  D: { label: "D", chip: "bg-tier-d text-white", edge: "border-l-tier-d" },
  F: { label: "F", chip: "bg-tier-f text-white", edge: "border-l-tier-f" },
};

export default async function TierListDetailPage({ params }: Params) {
  const list = await getTierListBySlug(params.slug);
  if (!list) notFound();

  const profile = await getCurrentProfile();
  const isStaff = !!profile && isModerator(profile.role);

  return (
    <div className="container max-w-5xl space-y-8 py-12">
      {isStaff ? (
        <form action={deleteTierListFromDetailAction}>
          <input type="hidden" name="id" value={list.id} />
          <button className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
            Delete tier list (staff)
          </button>
        </form>
      ) : null}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            {list.title}
          </h1>
          {list.isOfficial ? (
            <OfficialBadge />
          ) : (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Community
            </span>
          )}
        </div>
        {list.description ? (
          <p className="text-muted-foreground">{list.description}</p>
        ) : null}
      </header>

      <div className="space-y-4">
        {list.tiers.map(({ tier, perks }) => {
          const style = TIER_STYLE[tier];
          return (
            <section
              key={tier}
              className={`flex flex-col gap-3 rounded-lg border border-border/60 border-l-4 ${style.edge} p-4 sm:flex-row sm:gap-4`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md font-display text-2xl font-bold ${style.chip}`}
                aria-label={`Tier ${style.label}`}
              >
                {style.label}
              </div>
              <ul className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {perks.map((perk) => (
                  <li key={perk.id}>
                    <Link
                      href={`/perks/${perk.slug}`}
                      className="flex h-full items-center gap-2 rounded-md border border-border/50 p-2 transition-colors hover:border-border"
                    >
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded border border-border/60">
                        <AssetThumb
                          src={perk.iconUrl}
                          alt={perk.name}
                          fallbackLabel={initialsFrom(perk.name)}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {perk.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {perk.origin ? perk.origin.name : "Universal perk"}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Tap a perk to open its page. Tier placements are an editorial snapshot
        and change with the meta.
      </p>
    </div>
  );
}
