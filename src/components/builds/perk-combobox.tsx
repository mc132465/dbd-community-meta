"use client";

import { useMemo, useRef, useState } from "react";

import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";

export type PerkOption = {
  id: string;
  name: string;
  iconUrl?: string | null;
};

/**
 * Searchable single-perk picker. Live-filters by name, shows the perk PNG in
 * both the trigger and the options, and hides perks listed in `excludeIds`
 * (perks already chosen in other slots) so the same perk can't be picked twice.
 */
export function PerkCombobox({
  label,
  perks,
  value,
  excludeIds,
  onChange,
}: {
  label: string;
  perks: PerkOption[];
  value: string;
  excludeIds: string[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = perks.find((p) => p.id === value) ?? null;
  const exclude = new Set(excludeIds);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return perks.filter((p) => {
      if (p.id !== value && exclude.has(p.id)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perks, query, value, excludeIds]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {selected ? (
          <>
            <span className="h-6 w-6 shrink-0 overflow-hidden rounded border border-border/60">
              <AssetThumb
                src={selected.iconUrl ?? null}
                alt={selected.name}
                fallbackLabel={initialsFrom(selected.name)}
              />
            </span>
            <span className="min-w-0 flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">{label}</span>
        )}
        <span className="shrink-0 text-xs text-muted-foreground">▾</span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover p-1 shadow-md">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search perks…"
            className="mb-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Search perks"
          />
          <ul className="max-h-60 overflow-auto" role="listbox">
            {value ? (
              <li>
                <button
                  type="button"
                  onClick={() => choose("")}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
                >
                  Clear selection
                </button>
              </li>
            ) : null}
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                No perks match.
              </li>
            ) : (
              filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={p.id === value}
                    onClick={() => choose(p.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                      p.id === value ? "bg-muted" : ""
                    }`}
                  >
                    <span className="h-6 w-6 shrink-0 overflow-hidden rounded border border-border/60">
                      <AssetThumb
                        src={p.iconUrl ?? null}
                        alt={p.name}
                        fallbackLabel={initialsFrom(p.name)}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
