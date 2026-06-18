import {
  listActivePerkLabels,
  listAllPerkLabels,
  listPerkLabelCategories,
} from "@/lib/services/perk-labels.service";
import { listTierListsWithTierCounts } from "@/lib/services/tierlists.service";
import { PerkLabelManager } from "@/components/admin/perk-label-manager";
import { ApplyLabelFromTier } from "@/components/admin/apply-label-from-tier";

export default async function AdminPerkLabelsPage() {
  const [labels, categories, activeLabels, tierLists] = await Promise.all([
    listAllPerkLabels(),
    listPerkLabelCategories(),
    listActivePerkLabels(),
    listTierListsWithTierCounts(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Perk Labels
        </h2>
        <p className="text-sm text-muted-foreground">
          Create, edit, disable, and categorize perk labels. Labels classify
          individual perks (Meta, Endgame, Slowdown…) — separate from build
          tags, which describe whole builds.
        </p>
      </div>

      <ApplyLabelFromTier
        tierLists={tierLists.map((l) => ({
          id: l.id,
          title: l.title,
          tiers: l.tiers.map((t) => ({ tier: t.tier, count: t.count })),
        }))}
        labels={activeLabels.map((l) => ({ id: l.id, name: l.name }))}
      />

      <PerkLabelManager
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        labels={labels.map((l) => ({
          id: l.id,
          name: l.name,
          slug: l.slug,
          category_id: l.category_id,
          is_active: l.is_active,
          category_name: l.category?.name ?? null,
        }))}
      />
    </div>
  );
}
