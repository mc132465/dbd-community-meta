"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import { addRecommendationAction } from "@/app/admin/recommendations/actions";

export type PerkOption = { id: string; name: string; icon: string | null };

export function RecommendationForm({
  characterId,
  perks,
}: {
  characterId: string;
  perks: PerkOption[];
}) {
  const router = useRouter();
  const [perkId, setPerkId] = useState("");
  const [perkLabel, setPerkLabel] = useState("");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return perks.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, perks]);

  function pick(p: PerkOption) {
    setPerkId(p.id);
    setPerkLabel(p.name);
    setQuery("");
  }

  async function submit() {
    if (!perkId) {
      setMsg("Choose a perk first.");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const r = await addRecommendationAction(characterId, perkId, note, sortOrder);
      if (r.ok) {
        setPerkId("");
        setPerkLabel("");
        setNote("");
        setSortOrder(0);
        router.refresh();
      } else {
        setMsg(r.error);
      }
    } catch {
      setMsg("Could not add.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
      <h3 className="text-sm font-semibold">Add a recommendation</h3>

      {perkId ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Perk:</span>
          <strong>{perkLabel}</strong>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-destructive"
            onClick={() => {
              setPerkId("");
              setPerkLabel("");
            }}
          >
            change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
            placeholder="Search killer perks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {matches.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/60"
                  >
                    <AssetThumb
                      src={p.icon}
                      alt={p.name}
                      fallbackLabel={initialsFrom(p.name)}
                      className="h-6 w-6 rounded"
                    />
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground" htmlFor="rec-note">
          Synergy note (optional)
        </label>
        <textarea
          id="rec-note"
          rows={2}
          className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
          placeholder="e.g. extends the slowdown from your power."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="rec-order">
          Order
        </label>
        <input
          id="rec-order"
          type="number"
          className="w-20 rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="ml-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
      {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
    </div>
  );
}
