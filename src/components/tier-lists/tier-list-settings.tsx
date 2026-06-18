"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

import {
  archiveTierListAction,
  deleteTierListAction,
  publishTierListAction,
  updateTierLabelsAction,
  updateTierListAction,
} from "@/app/(main)/tier-lists/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fieldClass =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TierListSettings({
  tierListId,
  slug,
  title: initialTitle,
  description: initialDescription,
  status,
  labels: initialLabels,
}: {
  tierListId: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  labels: string[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [labels, setLabels] = useState<string[]>(initialLabels);
  const [busy, setBusy] = useState(false);

  async function saveMeta() {
    setBusy(true);
    const r = await updateTierListAction(tierListId, slug, {
      title,
      description,
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Save failed");
    toast.success("Saved");
    router.refresh();
  }

  async function saveLabels() {
    const clean = labels.map((l) => l.trim()).filter(Boolean);
    if (clean.length === 0) return toast.error("Add at least one tier label.");
    setBusy(true);
    const r = await updateTierLabelsAction(tierListId, slug, { labels: clean });
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Save failed");
    toast.success("Tier labels saved");
    router.refresh();
  }

  async function publish() {
    setBusy(true);
    const r = await publishTierListAction(tierListId, slug);
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Publish failed");
    toast.success("Published");
    router.refresh();
  }

  async function archive() {
    setBusy(true);
    const r = await archiveTierListAction(tierListId, slug);
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Archive failed");
    toast.success("Archived");
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this tier list? This cannot be undone.")) return;
    setBusy(true);
    const r = await deleteTierListAction(tierListId);
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Delete failed");
    toast.success("Deleted");
    router.push("/tier-lists");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="tl-title">Title</Label>
          <Input
            id="tl-title"
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tl-desc">Description</Label>
          <textarea
            id="tl-desc"
            className={`${fieldClass} min-h-20`}
            value={description}
            maxLength={4000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <Button size="sm" disabled={busy} onClick={saveMeta}>
          Save details
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Tier labels</Label>
        <div className="flex flex-wrap gap-2">
          {labels.map((l, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                value={l}
                maxLength={24}
                onChange={(e) =>
                  setLabels((arr) =>
                    arr.map((x, idx) => (idx === i ? e.target.value : x)),
                  )
                }
                className="h-9 w-16 rounded-md border border-input bg-background px-2 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                aria-label="Remove tier"
                onClick={() =>
                  setLabels((arr) => arr.filter((_, idx) => idx !== i))
                }
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLabels((arr) => [...arr, "New"])}
            className="flex h-9 items-center gap-1 rounded-md border border-dashed border-border px-2 text-sm text-muted-foreground hover:border-foreground/40"
          >
            <Plus className="h-4 w-4" /> Add tier
          </button>
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={saveLabels}>
          Save tier labels
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
        {status !== "published" ? (
          <Button disabled={busy} onClick={publish}>
            Publish
          </Button>
        ) : (
          <Button variant="outline" disabled={busy} onClick={archive}>
            Unpublish (archive)
          </Button>
        )}
        <Button variant="outline" disabled={busy} onClick={remove}>
          Delete
        </Button>
        <span className="self-center text-xs text-muted-foreground">
          Status: {status}
        </span>
      </div>
    </div>
  );
}
