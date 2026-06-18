"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  clearOwnedPerksAction,
  setManyOwnedPerksAction,
  setOwnedPerkAction,
} from "@/app/account/perks/actions";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import { RoleBadge } from "@/components/assets/asset-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PerkItem = {
  id: string;
  name: string;
  slug: string;
  role: "killer" | "survivor" | null;
  iconUrl: string | null;
  origin: string | null;
  labels: string[]; // active label slugs
};

type LabelOption = { slug: string; name: string };
type RoleFilter = "all" | "killer" | "survivor";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MyPerksManager({
  perks,
  ownedIds,
  labels,
}: {
  perks: PerkItem[];
  ownedIds: string[];
  labels: LabelOption[];
}) {
  const [owned, setOwned] = useState<Set<string>>(new Set(ownedIds));
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [labelSlug, setLabelSlug] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return perks.filter((p) => {
      if (role !== "all" && p.role !== role) return false;
      if (labelSlug && !p.labels.includes(labelSlug)) return false;
      if (ownedOnly && !owned.has(p.id)) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !(p.origin ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [perks, search, role, labelSlug, ownedOnly, owned]);

  async function toggle(perk: PerkItem) {
    const next = !owned.has(perk.id);
    setOwned((prev) => {
      const s = new Set(prev);
      if (next) s.add(perk.id);
      else s.delete(perk.id);
      return s;
    });
    const result = await setOwnedPerkAction(perk.id, next);
    if (!result.ok) {
      // revert on failure
      setOwned((prev) => {
        const s = new Set(prev);
        if (next) s.delete(perk.id);
        else s.add(perk.id);
        return s;
      });
      toast.error(result.error ?? "Couldn't update");
    }
  }

  async function bulkVisible(owning: boolean) {
    const ids = filtered.map((p) => p.id);
    if (ids.length === 0) return;
    const before = new Set(owned);
    setOwned((prev) => {
      const s = new Set(prev);
      for (const id of ids) {
        if (owning) s.add(id);
        else s.delete(id);
      }
      return s;
    });
    setBusy(true);
    const result = await setManyOwnedPerksAction(ids, owning);
    setBusy(false);
    if (!result.ok) {
      setOwned(before);
      toast.error(result.error ?? "Couldn't update");
      return;
    }
    toast.success(
      `${owning ? "Marked" : "Cleared"} ${ids.length} perk(s)`,
    );
  }

  async function clearAll() {
    if (owned.size === 0) return;
    if (!confirm("Clear ALL owned perks? This can't be undone.")) return;
    const before = new Set(owned);
    setOwned(new Set());
    setBusy(true);
    const result = await clearOwnedPerksAction();
    setBusy(false);
    if (!result.ok) {
      setOwned(before);
      toast.error(result.error ?? "Couldn't clear");
      return;
    }
    toast.success("Cleared all owned perks");
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          placeholder="Search perks or characters…"
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          aria-label="Search perks"
        />
        <select
          className={selectClass}
          value={role}
          onChange={(e) => setRole(e.target.value as RoleFilter)}
          aria-label="Role filter"
        >
          <option value="all">All roles</option>
          <option value="killer">Killer</option>
          <option value="survivor">Survivor</option>
        </select>
        {labels.length > 0 ? (
          <select
            className={selectClass}
            value={labelSlug}
            onChange={(e) => setLabelSlug(e.target.value)}
            aria-label="Label filter"
          >
            <option value="">All labels</option>
            {labels.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.name}
              </option>
            ))}
          </select>
        ) : null}
        <Button
          type="button"
          variant={ownedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setOwnedOnly((v) => !v)}
        >
          {ownedOnly ? "Showing owned" : "Show owned only"}
        </Button>
      </div>

      {/* Bulk actions + count */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {owned.size} owned · {filtered.length} shown
        </span>
        <span className="flex-1" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || filtered.length === 0}
          onClick={() => bulkVisible(true)}
        >
          Select all visible
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || filtered.length === 0}
          onClick={() => bulkVisible(false)}
        >
          Clear visible
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={busy || owned.size === 0}
          onClick={clearAll}
        >
          Clear all owned
        </Button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No perks match these filters.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((perk) => {
            const isOwned = owned.has(perk.id);
            return (
              <li key={perk.id}>
                <button
                  type="button"
                  aria-pressed={isOwned}
                  onClick={() => toggle(perk)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    isOwned
                      ? "border-primary bg-primary/10"
                      : "border-border/60 hover:border-border"
                  }`}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-border/60">
                    <AssetThumb
                      src={perk.iconUrl}
                      alt={perk.name}
                      fallbackLabel={initialsFrom(perk.name)}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {perk.name}
                      </span>
                      <RoleBadge role={perk.role} />
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {perk.origin ?? "Universal perk"}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 text-xs ${
                      isOwned ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {isOwned ? "Owned" : "Add"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
