"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveEditorialAction } from "@/app/admin/builds/actions";
import { DIFFICULTIES } from "@/lib/builds/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type PerkSlot = { slot: number; name: string };
type TagOption = { id: string; name: string };

type Props = {
  buildId: string;
  perkSlots: PerkSlot[];
  tags: TagOption[];
  initial: {
    overall_strategy: string;
    strengths: string;
    weaknesses: string;
    recommended_difficulty: string;
    official_tag_ids: string[];
    is_featured: boolean;
    published: boolean;
    perk_reasons: Record<number, string>;
  };
};

const textareaClass =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function EditorialForm({ buildId, perkSlots, tags, initial }: Props) {
  const router = useRouter();
  const [strategy, setStrategy] = useState(initial.overall_strategy);
  const [strengths, setStrengths] = useState(initial.strengths);
  const [weaknesses, setWeaknesses] = useState(initial.weaknesses);
  const [difficulty, setDifficulty] = useState(initial.recommended_difficulty);
  const [tagIds, setTagIds] = useState<string[]>(initial.official_tag_ids);
  const [featured, setFeatured] = useState(initial.is_featured);
  const [published, setPublished] = useState(initial.published);
  const [reasons, setReasons] = useState<Record<number, string>>(
    initial.perk_reasons,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await saveEditorialAction(buildId, {
      overall_strategy: strategy,
      strengths,
      weaknesses,
      recommended_difficulty: difficulty,
      official_tag_ids: tagIds,
      is_featured: featured,
      published,
      perk_reasons: perkSlots.map((s) => ({
        slot: s.slot,
        reason: reasons[s.slot] ?? "",
      })),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    toast.success("Editorial saved");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Why This Build Works — per perk
        </h3>
        {perkSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This build has no perks selected yet.
          </p>
        ) : (
          perkSlots.map((s) => (
            <div key={s.slot} className="space-y-1.5">
              <Label htmlFor={`reason-${s.slot}`}>{s.name}</Label>
              <textarea
                id={`reason-${s.slot}`}
                rows={2}
                className={textareaClass}
                value={reasons[s.slot] ?? ""}
                onChange={(e) =>
                  setReasons((prev) => ({ ...prev, [s.slot]: e.target.value }))
                }
                placeholder="What this perk does for the build and how it synergizes."
              />
            </div>
          ))
        )}
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="strategy">Overall strategy</Label>
        <textarea
          id="strategy"
          rows={4}
          className={textareaClass}
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="strengths">Strengths</Label>
          <textarea
            id="strengths"
            rows={3}
            className={textareaClass}
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weaknesses">Weaknesses</Label>
          <textarea
            id="weaknesses"
            rows={3}
            className={textareaClass}
            value={weaknesses}
            onChange={(e) => setWeaknesses(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recommended">Recommended skill level</Label>
        <select
          id="recommended"
          className={selectClass}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">— none —</option>
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Official tags</Label>
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tags available.</p>
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

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="h-4 w-4"
          />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4"
          />
          Published as Official Build
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save editorial"}
      </Button>
    </form>
  );
}
