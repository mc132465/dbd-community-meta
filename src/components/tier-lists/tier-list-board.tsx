"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { X } from "lucide-react";

import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import {
  addEntryAction,
  moveEntryAction,
  removeEntryAction,
} from "@/app/(main)/tier-lists/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const POOL_ID = "__pool__";

type Entry = {
  id: string;
  tier: string;
  position: number;
  targetType: string;
  targetId: string | null;
  label: string;
  iconUrl: string | null;
};
type PoolTarget = { id: string; name: string; iconUrl: string | null };

type Chip = {
  dragId: string; // entry:<id> | pool:<targetId>
  label: string;
  iconUrl: string | null;
  entryId?: string;
};

function DraggableChip({ chip, onRemove }: { chip: Chip; onRemove?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: chip.dragId });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`flex items-center gap-2 rounded-md border border-border/60 bg-card px-2 py-1 text-xs ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        className="flex items-center gap-2 touch-none"
        {...listeners}
        {...attributes}
      >
        <span className="h-6 w-6 shrink-0 overflow-hidden rounded border border-border/60">
          <AssetThumb
            src={chip.iconUrl}
            alt={chip.label}
            fallbackLabel={initialsFrom(chip.label)}
          />
        </span>
        <span className="max-w-32 truncate">{chip.label}</span>
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function DropZone({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ""} ${isOver ? "ring-2 ring-ring" : ""}`}
    >
      {children}
    </div>
  );
}

export function TierListBoard({
  tierListId,
  slug,
  category,
  tierLabels,
  entries,
  pool,
}: {
  tierListId: string;
  slug: string;
  category: string;
  tierLabels: string[];
  entries: Entry[];
  pool: PoolTarget[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [activeChip, setActiveChip] = useState<Chip | null>(null);
  const [custom, setCustom] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const placedTargetIds = new Set(
    entries.map((e) => e.targetId).filter(Boolean) as string[],
  );
  const available = pool.filter((p) => !placedTargetIds.has(p.id));
  const isCustom = category === "other";

  function tierEntries(tier: string) {
    return entries
      .filter((e) => e.tier === tier)
      .sort((a, b) => a.position - b.position);
  }

  function entryChip(e: Entry): Chip {
    return {
      dragId: `entry:${e.id}`,
      label: e.label,
      iconUrl: e.iconUrl,
      entryId: e.id,
    };
  }
  function poolChip(p: PoolTarget): Chip {
    return { dragId: `pool:${p.id}`, label: p.name, iconUrl: p.iconUrl };
  }

  function buildAddInput(targetId: string, tier: string) {
    const base: Record<string, unknown> = { tierListId, tier };
    if (category === "killer_perks" || category === "survivor_perks")
      base.perkId = targetId;
    else if (category === "killers" || category === "survivors")
      base.characterId = targetId;
    else if (category === "maps") base.mapId = targetId;
    return base;
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (id.startsWith("entry:")) {
      const entry = entries.find((x) => x.id === id.slice(6));
      if (entry) setActiveChip(entryChip(entry));
    } else if (id.startsWith("pool:")) {
      const t = pool.find((x) => x.id === id.slice(5));
      if (t) setActiveChip(poolChip(t));
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveChip(null);
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    const activeId = String(active.id);
    setBusy(true);
    try {
      if (activeId.startsWith("pool:")) {
        if (overId === POOL_ID) return;
        const targetId = activeId.slice(5);
        const r = await addEntryAction(slug, buildAddInput(targetId, overId));
        if (!r.ok) toast.error(r.error);
      } else if (activeId.startsWith("entry:")) {
        const entryId = activeId.slice(6);
        if (overId === POOL_ID) {
          const r = await removeEntryAction(slug, entryId);
          if (!r.ok) toast.error(r.error);
        } else {
          const position = tierEntries(overId).length;
          const r = await moveEntryAction(slug, {
            entryId,
            tier: overId,
            position,
          });
          if (!r.ok) toast.error(r.error);
        }
      }
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function removeEntry(entryId: string) {
    setBusy(true);
    const r = await removeEntryAction(slug, entryId);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error ?? "Remove failed");
      return;
    }
    router.refresh();
  }

  async function addCustom(tier: string) {
    if (!custom.trim()) return;
    setBusy(true);
    const r = await addEntryAction(slug, {
      tierListId,
      tier,
      customLabel: custom.trim(),
    });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error ?? "Add failed");
      return;
    }
    setCustom("");
    router.refresh();
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-3">
        {tierLabels.map((tier) => (
          <DropZone
            key={tier}
            id={tier}
            className="flex items-start gap-3 rounded-lg border border-border/60 p-2"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted font-display font-bold uppercase">
              {tier}
            </div>
            <div className="flex min-h-10 flex-1 flex-wrap gap-2">
              {tierEntries(tier).map((entry) => (
                <DraggableChip
                  key={entry.id}
                  chip={entryChip(entry)}
                  onRemove={() => removeEntry(entry.id)}
                />
              ))}
              {isCustom ? (
                <span className="self-center text-[11px] text-muted-foreground">
                  drag here or add below
                </span>
              ) : null}
            </div>
          </DropZone>
        ))}
      </div>

      {/* Pool / source */}
      <DropZone
        id={POOL_ID}
        className="mt-4 rounded-lg border border-dashed border-border/60 p-3"
      >
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {isCustom ? "Custom entries" : "Unranked"} — drag onto a tier (drag
          here to remove)
        </p>
        {isCustom ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="New entry label…"
              className="h-9 max-w-xs"
              maxLength={120}
            />
            <Button
              type="button"
              size="sm"
              disabled={busy || !custom.trim()}
              onClick={() => addCustom(tierLabels[0])}
            >
              Add to {tierLabels[0]}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {available.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Everything is placed.
              </span>
            ) : (
              available.map((p) => (
                <DraggableChip key={p.id} chip={poolChip(p)} />
              ))
            )}
          </div>
        )}
      </DropZone>

      <DragOverlay>
        {activeChip ? (
          <div className="flex items-center gap-2 rounded-md border border-primary bg-card px-2 py-1 text-xs">
            <span className="h-6 w-6 shrink-0 overflow-hidden rounded border border-border/60">
              <AssetThumb
                src={activeChip.iconUrl}
                alt={activeChip.label}
                fallbackLabel={initialsFrom(activeChip.label)}
              />
            </span>
            <span className="max-w-32 truncate">{activeChip.label}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
