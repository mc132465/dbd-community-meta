"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { PerkCombobox } from "@/components/builds/perk-combobox";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";

import type { GameRole } from "@/types/database";
import { submitBuildAction, submitBuildEditAction } from "@/app/(main)/builds/actions";
import { DIFFICULTIES } from "@/lib/builds/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = {
  id: string;
  name: string;
  role?: GameRole;
  iconUrl?: string | null;
};
type TagOption = { id: string; name: string; category?: string | null };

type Props = {
  characters: Option[];
  perks: Option[];
  addOns: Option[];
  items: Option[];
  tags: TagOption[];
  initialRole?: GameRole;
  initialPerkIds?: string[];
  initialTagIds?: string[];
  ownedPerkIds?: string[];
  // Edit mode: when set, the form submits an edit/revision for this build.
  editBuildId?: string;
  initialTitle?: string;
  initialCharacterId?: string;
  initialDifficulty?: string;
  initialAddOnIds?: string[];
  initialItemId?: string;
  // Killer-only curated perk suggestions, keyed by character id (optional).
  recommendationsByCharacter?: Record<string, RecPerkLite[]>;
};

export type RecPerkLite = {
  id: string;
  perkId: string;
  perkName: string;
  perkIcon: string | null;
  note: string | null;
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CommunityBuildForm({
  characters,
  perks,
  addOns,
  items,
  tags,
  initialRole,
  initialPerkIds,
  initialTagIds,
  ownedPerkIds,
  editBuildId,
  initialTitle,
  initialCharacterId,
  initialDifficulty,
  initialAddOnIds,
  initialItemId,
  recommendationsByCharacter,
}: Props) {
  const router = useRouter();
  const [role, setRole] = useState<GameRole>(initialRole ?? "killer");
  const [title, setTitle] = useState(initialTitle ?? "");
  const [characterId, setCharacterId] = useState(initialCharacterId ?? "");
  const [difficulty, setDifficulty] = useState(initialDifficulty ?? "");
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds ?? []);
  const [perkIds, setPerkIds] = useState<string[]>(() => {
    const base = ["", "", "", ""];
    (initialPerkIds ?? []).slice(0, 4).forEach((id, i) => {
      base[i] = id;
    });
    return base;
  });
  const [addOnIds, setAddOnIds] = useState<string[]>(() => {
    const base = ["", ""];
    (initialAddOnIds ?? []).slice(0, 2).forEach((id, i) => {
      base[i] = id;
    });
    return base;
  });
  const [itemId, setItemId] = useState(initialItemId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const roleCharacters = useMemo(
    () => characters.filter((c) => c.role === role),
    [characters, role],
  );
  const rolePerks = useMemo(
    () => perks.filter((p) => p.role === role),
    [perks, role],
  );

  const ownedSet = useMemo(
    () => new Set(ownedPerkIds ?? []),
    [ownedPerkIds],
  );
  const [ownedOnly, setOwnedOnly] = useState(false);
  const hasOwned = ownedSet.size > 0;
  const visiblePerks = useMemo(
    () => (ownedOnly ? rolePerks.filter((p) => ownedSet.has(p.id)) : rolePerks),
    [ownedOnly, rolePerks, ownedSet],
  );
  // Advisory only: which selected perks the user doesn't own (when they have a
  // collection recorded). Never blocks submission.
  const unownedSelected = useMemo(
    () =>
      hasOwned
        ? perkIds
            .filter(Boolean)
            .filter((id) => !ownedSet.has(id))
            .map((id) => perks.find((p) => p.id === id)?.name ?? "a perk")
        : [],
    [hasOwned, perkIds, ownedSet, perks],
  );

  function setPerk(i: number, value: string) {
    setPerkIds((prev) => prev.map((p, idx) => (idx === i ? value : p)));
  }

  // Killer-only curated suggestions for the selected character (top 2 shown).
  const recommendations = useMemo(() => {
    if (role !== "killer" || !characterId) return [];
    return (recommendationsByCharacter?.[characterId] ?? []).slice(0, 2);
  }, [role, characterId, recommendationsByCharacter]);

  function addRecommendedPerk(perkId: string) {
    setPerkIds((prev) => {
      if (prev.includes(perkId)) return prev;
      const slot = prev.findIndex((p) => !p);
      if (slot === -1) return prev;
      return prev.map((p, idx) => (idx === slot ? perkId : p));
    });
  }
  function setAddOn(i: number, value: string) {
    setAddOnIds((prev) => prev.map((a, idx) => (idx === i ? value : a)));
  }
  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const chosenPerks = perkIds.filter(Boolean);
    if (!characterId) return setError("Choose a character.");
    if (chosenPerks.length === 0) return setError("Pick at least one perk.");
    if (new Set(chosenPerks).size !== chosenPerks.length)
      return setError("Each perk can only be used once.");

    setSubmitting(true);
    const payload = {
      title,
      role,
      character_id: characterId,
      difficulty_suggestion: difficulty,
      tag_ids: tagIds,
      perk_ids: chosenPerks,
      add_on_ids: addOnIds.filter(Boolean),
      item_id: itemId,
    };

    if (editBuildId) {
      const result = await submitBuildEditAction(editBuildId, payload, "");
      setSubmitting(false);
      if (!result.ok) return setError(result.error);
      toast.success(
        result.status === "pending_review"
          ? "Revision submitted for review"
          : "Build updated",
      );
      router.push("/builds/mine");
      router.refresh();
      return;
    }

    const result = await submitBuildAction(payload);
    setSubmitting(false);

    if (!result.ok) return setError(result.error);

    if (result.status === "approved") {
      toast.success("Build published");
      router.push(`/builds/${result.slug}`);
    } else {
      toast.success("Build submitted for review");
      router.push("/builds/mine");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Title (optional)</Label>
        <Input
          id="title"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Gen-defense starter"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role">Side *</Label>
          <select
            id="role"
            className={selectClass}
            value={role}
            onChange={(e) => {
              setRole(e.target.value as GameRole);
              setCharacterId("");
              setPerkIds(["", "", "", ""]);
            }}
          >
            <option value="killer">Killer</option>
            <option value="survivor">Survivor</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="character">Character *</Label>
          <select
            id="character"
            className={selectClass}
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
          >
            <option value="">— select —</option>
            {roleCharacters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Perks * (up to 4)</Label>
          <button
            type="button"
            aria-pressed={ownedOnly}
            onClick={() => setOwnedOnly((v) => !v)}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              ownedOnly
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/40"
            }`}
          >
            {ownedOnly ? "Showing my owned perks" : "Show only my owned perks"}
          </button>
        </div>

        {ownedOnly && !hasOwned ? (
          <p className="rounded-md border border-border/60 p-3 text-xs text-muted-foreground">
            You haven&apos;t marked any owned perks yet. Set up your collection in{" "}
            <Link href="/account/perks" className="text-link hover:text-link-hover hover:underline">
              My Perks
            </Link>
            , or switch back to all perks.
          </p>
        ) : null}

        {unownedSelected.length > 0 ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
            Heads up: you don&apos;t own {unownedSelected.join(", ")}. You can
            still submit this build.
          </p>
        ) : null}

        {recommendations.length > 0 ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Recommended perks
            </p>
            <ul className="mt-2 space-y-2">
              {recommendations.map((rec) => {
                const added = perkIds.includes(rec.perkId);
                const full = perkIds.every(Boolean);
                return (
                  <li key={rec.id} className="flex items-start gap-2 text-sm">
                    <AssetThumb
                      src={rec.perkIcon}
                      alt={rec.perkName}
                      fallbackLabel={initialsFrom(rec.perkName)}
                      className="h-7 w-7 rounded"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{rec.perkName}</span>
                      {rec.note ? (
                        <p className="text-xs text-muted-foreground">{rec.note}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => addRecommendedPerk(rec.perkId)}
                      disabled={added || full}
                      className="shrink-0 rounded-md border border-primary/40 px-2.5 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
                    >
                      {added ? "Added" : full ? "Slots full" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Optional suggestions — add them or ignore them.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <PerkCombobox
              key={i}
              label={`Perk ${i + 1}`}
              perks={visiblePerks.map((p) => ({
                id: p.id,
                name: p.name,
                iconUrl: p.iconUrl,
              }))}
              value={perkIds[i]}
              excludeIds={perkIds.filter((id, idx) => id && idx !== i)}
              onChange={(id) => setPerk(i, id)}
            />
          ))}
        </div>
      </div>

      {role === "survivor" ? (
        <div className="space-y-2">
          <Label htmlFor="item">Item (optional)</Label>
          <select
            id="item"
            className={selectClass}
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            <option value="">— none —</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Add-ons (optional, up to 2)</Label>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <select
              key={i}
              className={selectClass}
              value={addOnIds[i]}
              onChange={(e) => setAddOn(i, e.target.value)}
              aria-label={`Add-on ${i + 1}`}
            >
              <option value="">— add-on {i + 1} —</option>
              {addOns.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="difficulty">Difficulty suggestion (optional)</Label>
        <select
          id="difficulty"
          className={selectClass}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">— no suggestion —</option>
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Tags (optional)</Label>
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No tags available yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                type="button"
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  tagIds.includes(tag.id)
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground/40"
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        You provide the loadout. Editorial explanations are added by staff if
        your build is featured. Submitted builds are reviewed before going public.
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit build"}
      </Button>
    </form>
  );
}
