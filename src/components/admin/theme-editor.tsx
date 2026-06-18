"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ThemeSettings } from "@/lib/services/settings.service";
import { saveThemeAction } from "@/app/admin/theme/actions";
import { Button } from "@/components/ui/button";

type Field = { key: keyof ThemeSettings; label: string };
type Group = { title: string; fields: Field[] };

const GROUPS: Group[] = [
  {
    title: "Brand",
    fields: [
      { key: "accent", label: "Accent" },
      { key: "button", label: "Button" },
      { key: "link", label: "Link" },
      { key: "linkHover", label: "Link hover" },
    ],
  },
  {
    title: "Tier colors",
    fields: [
      { key: "tierS", label: "S" },
      { key: "tierA", label: "A" },
      { key: "tierB", label: "B" },
      { key: "tierC", label: "C" },
      { key: "tierD", label: "D" },
      { key: "tierF", label: "F" },
    ],
  },
  {
    title: "Difficulty colors",
    fields: [
      { key: "difficultyBeginner", label: "Beginner" },
      { key: "difficultyIntermediate", label: "Intermediate" },
      { key: "difficultyAdvanced", label: "Advanced" },
    ],
  },
  {
    title: "Badge / status colors",
    fields: [
      { key: "badgePending", label: "Pending" },
      { key: "badgeApproved", label: "Approved" },
      { key: "badgeRejected", label: "Rejected" },
      { key: "badgeDraft", label: "Draft" },
      { key: "badgeArchived", label: "Archived" },
    ],
  },
];

export function ThemeEditor({
  current,
  defaults,
}: {
  current: ThemeSettings;
  defaults: ThemeSettings;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ThemeSettings>(current);
  const [busy, setBusy] = useState(false);

  function setField(key: keyof ThemeSettings, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function save(partial: Partial<ThemeSettings>, label: string) {
    setBusy(true);
    const r = await saveThemeAction(partial);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error ?? "Save failed");
      return;
    }
    toast.success(`${label} saved`);
    router.refresh();
  }

  function saveGroup(group: Group) {
    const partial: Partial<ThemeSettings> = {};
    for (const f of group.fields) partial[f.key] = values[f.key];
    save(partial, group.title);
  }

  function resetGroup(group: Group) {
    const partial: Partial<ThemeSettings> = {};
    for (const f of group.fields) partial[f.key] = defaults[f.key];
    setValues((v) => ({ ...v, ...partial }));
    save(partial, `${group.title} (defaults)`);
  }

  function resetAll() {
    setValues(defaults);
    save(defaults, "All colors (defaults)");
  }

  return (
    <div className="space-y-8">
      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {group.title}
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => resetGroup(group)}
              >
                Reset
              </Button>
              <Button size="sm" disabled={busy} onClick={() => saveGroup(group)}>
                Save {group.title.toLowerCase()}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.fields.map((f) => {
              const value = values[f.key];
              const saved = current[f.key];
              const def = defaults[f.key];
              const changed = value.toLowerCase() !== saved.toLowerCase();
              return (
                <div
                  key={f.key}
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
                >
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => setField(f.key, e.target.value)}
                    aria-label={f.label}
                    className="h-10 w-10 shrink-0 cursor-pointer rounded border border-border/60 bg-transparent"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{f.label}</span>
                      {changed ? (
                        <span className="text-[10px] uppercase text-primary">
                          unsaved
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      saved {saved}
                      {def.toLowerCase() !== saved.toLowerCase() ? (
                        <> · default {def}</>
                      ) : null}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex justify-end border-t border-border/60 pt-4">
        <Button variant="outline" disabled={busy} onClick={resetAll}>
          Reset all to defaults
        </Button>
      </div>
    </div>
  );
}
