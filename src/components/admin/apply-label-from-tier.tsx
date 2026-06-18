"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { applyPerkLabelFromTierAction } from "@/app/admin/perk-labels/actions";
import { Button } from "@/components/ui/button";

type TierCount = { tier: string; count: number };
type TierListOption = { id: string; title: string; tiers: TierCount[] };
type LabelOption = { id: string; name: string };

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ApplyLabelFromTier({
  tierLists,
  labels,
}: {
  tierLists: TierListOption[];
  labels: LabelOption[];
}) {
  const router = useRouter();
  const [tierListId, setTierListId] = useState("");
  const [tier, setTier] = useState("");
  const [labelId, setLabelId] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedList = tierLists.find((l) => l.id === tierListId);
  const tierOptions = selectedList?.tiers ?? [];
  const affected =
    tierOptions.find((t) => t.tier === tier)?.count ?? 0;
  const ready = Boolean(tierListId && tier && labelId);

  async function apply() {
    setBusy(true);
    const result = await applyPerkLabelFromTierAction({
      tierListId,
      tier,
      labelId,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success(`Label applied to ${result.count} perk(s) in ${tier} tier`);
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-lg border border-border/60 p-4">
      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
          Apply label from a tier
        </h3>
        <p className="text-xs text-muted-foreground">
          Assign one active label to every perk in a tier (e.g. Otzdarva S-tier →
          Meta). Additive only — existing labels are kept and duplicates are
          skipped.
        </p>
      </div>

      {tierLists.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tier lists with entries yet.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <select
              className={selectClass}
              value={tierListId}
              onChange={(e) => {
                setTierListId(e.target.value);
                setTier("");
              }}
            >
              <option value="">— tier list —</option>
              {tierLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>

            <select
              className={selectClass}
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              disabled={!selectedList}
            >
              <option value="">— tier —</option>
              {tierOptions.map((t) => (
                <option key={t.tier} value={t.tier}>
                  {t.tier} ({t.count})
                </option>
              ))}
            </select>

            <select
              className={selectClass}
              value={labelId}
              onChange={(e) => setLabelId(e.target.value)}
            >
              <option value="">— label —</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {ready ? (
            <p className="text-xs text-muted-foreground">
              This will affect{" "}
              <span className="text-foreground">{affected} perk(s)</span> in{" "}
              {tier} tier.
            </p>
          ) : null}

          <Button size="sm" disabled={busy || !ready} onClick={apply}>
            Apply label to tier
          </Button>
        </>
      )}
    </section>
  );
}
