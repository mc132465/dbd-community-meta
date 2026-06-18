"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { SiteTexts } from "@/lib/services/settings.service";
import { saveSiteTextsAction } from "@/app/admin/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldDef = {
  key: keyof SiteTexts;
  label: string;
  multiline?: boolean;
  hint?: string;
};

const FIELDS: FieldDef[] = [
  { key: "siteName", label: "Site name" },
  { key: "tagline", label: "Tagline", multiline: true },
  { key: "heroTitle", label: "Homepage hero title", multiline: true },
  { key: "heroSubtitle", label: "Homepage hero subtitle", multiline: true },
  { key: "footerText", label: "Footer text", multiline: true },
  {
    key: "announcement",
    label: "Announcement banner",
    multiline: true,
    hint: "Leave blank to hide the banner.",
  },
];

const fieldClass =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SiteTextsEditor({
  current,
  defaults,
}: {
  current: SiteTexts;
  defaults: SiteTexts;
}) {
  const router = useRouter();
  const [values, setValues] = useState<SiteTexts>(current);
  const [busy, setBusy] = useState(false);

  function setField(key: keyof SiteTexts, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function persist(next: SiteTexts, label: string) {
    setBusy(true);
    const r = await saveSiteTextsAction(next);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error ?? "Save failed");
      return;
    }
    toast.success(label);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {FIELDS.map((f) => {
        const value = values[f.key];
        const changed = value !== current[f.key];
        return (
          <div key={f.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={f.key}>{f.label}</Label>
              {changed ? (
                <span className="text-[10px] uppercase text-primary">
                  unsaved
                </span>
              ) : null}
            </div>
            {f.multiline ? (
              <textarea
                id={f.key}
                value={value}
                maxLength={2000}
                onChange={(e) => setField(f.key, e.target.value)}
                className={`${fieldClass} min-h-20`}
              />
            ) : (
              <Input
                id={f.key}
                value={value}
                maxLength={2000}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            )}
            {f.hint ? (
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            ) : null}
          </div>
        );
      })}

      <div className="flex justify-between border-t border-border/60 pt-4">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setValues(defaults);
            persist(defaults, "Reset to defaults");
          }}
        >
          Reset to defaults
        </Button>
        <Button disabled={busy} onClick={() => persist(values, "Texts saved")}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
