"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { setPerkLabelsAction } from "@/app/admin/perk-labels/actions";
import { Button } from "@/components/ui/button";

type LabelOption = { id: string; name: string };

export function PerkLabelAssigner({
  perkId,
  options,
  assigned,
}: {
  perkId: string;
  options: LabelOption[];
  assigned: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(assigned));
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    const result = await setPerkLabelsAction(perkId, [...selected]);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Labels saved");
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-lg border border-border/60 p-4">
      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
          Perk labels
        </h3>
        <p className="text-xs text-muted-foreground">
          Classify this perk (Meta, Endgame, Slowdown…). Only active labels are
          shown.
        </p>
      </div>

      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active labels.{" "}
          <Link href="/admin/perk-labels" className="text-link hover:text-link-hover hover:underline">
            Manage labels
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {options.map((label) => {
              const on = selected.has(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(label.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    on
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40"
                  }`}
                >
                  {label.name}
                </button>
              );
            })}
          </div>
          <Button size="sm" disabled={busy} onClick={save}>
            Save labels
          </Button>
        </>
      )}
    </section>
  );
}
