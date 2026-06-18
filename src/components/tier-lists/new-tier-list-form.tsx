"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createTierListAction } from "@/app/(main)/tier-lists/actions";
import { TIER_CATEGORIES, type TierCategory } from "@/lib/validations/tier-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORY_LABEL: Record<TierCategory, string> = {
  killer_perks: "Killer Perks",
  survivor_perks: "Survivor Perks",
  killers: "Killers",
  survivors: "Survivors",
  maps: "Maps",
  other: "Other (custom)",
};

const fieldClass =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NewTierListForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TierCategory>("killer_perks");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await createTierListAction({ title, description, category });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error ?? "Couldn't create the tier list");
      return;
    }
    toast.success("Tier list created");
    router.push(`/tier-lists/${r.slug}/edit`);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. My Killer Perk Tier List"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">Category *</Label>
        <select
          id="category"
          className={`${fieldClass} h-10`}
          value={category}
          onChange={(e) => setCategory(e.target.value as TierCategory)}
        >
          {TIER_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          The category is fixed once you add entries.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          className={`${fieldClass} min-h-24`}
          value={description}
          maxLength={4000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy || !title.trim()}>
        {busy ? "Creating…" : "Create & edit"}
      </Button>
    </form>
  );
}
