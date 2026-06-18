"use client";

import { useMemo, useState } from "react";

import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import { savePicksAction } from "@/app/account/profile/actions";
import type { ProfilePickKind } from "@/types/database";

export type PickOption = { id: string; name: string; image: string | null };

export function PickEditor({
  kind,
  label,
  description,
  options,
  initial,
  cap,
}: {
  kind: ProfilePickKind;
  label: string;
  description?: string;
  options: PickOption[];
  initial: PickOption[];
  cap: number;
}) {
  const [selected, setSelected] = useState<PickOption[]>(initial);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter((o) => !selectedIds.has(o.id) && o.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, options, selectedIds]);

  const full = selected.length >= cap;

  function add(o: PickOption) {
    if (full || selectedIds.has(o.id)) return;
    setSelected((prev) => [...prev, o]);
    setQuery("");
  }
  function remove(id: string) {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await savePicksAction(
        kind,
        selected.map((s) => s.id),
      );
      setMsg(r.ok ? "Saved." : r.error);
    } catch {
      setMsg("Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">{label}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-full border border-border/60 py-1 pl-1 pr-2 text-sm"
            >
              <AssetThumb
                src={s.image}
                alt={s.name}
                fallbackLabel={initialsFrom(s.name)}
                className="h-6 w-6 rounded-full"
              />
              {s.name}
              <button
                type="button"
                onClick={() => remove(s.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${s.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">None selected.</p>
      )}

      {!full ? (
        <div className="relative">
          <input
            className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
            placeholder={`Search to add (max ${cap})…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {matches.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
              {matches.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => add(o)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/60"
                  >
                    <AssetThumb
                      src={o.image}
                      alt={o.name}
                      fallbackLabel={initialsFrom(o.name)}
                      className="h-6 w-6 rounded"
                    />
                    {o.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Maximum reached.</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md border border-border/60 px-3 py-1.5 text-sm font-medium hover:border-border disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </div>
    </div>
  );
}
