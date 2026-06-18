import { cn } from "@/lib/utils";
import type { BuildDifficulty, BuildStatus } from "@/types/database";
import { STATUS_LABELS, difficultyMeta } from "@/lib/builds/constants";

const DIFFICULTY_TONE: Record<BuildDifficulty, string> = {
  beginner: "border-difficulty-beginner/40 text-difficulty-beginner",
  intermediate: "border-difficulty-intermediate/40 text-difficulty-intermediate",
  advanced: "border-difficulty-advanced/40 text-difficulty-advanced",
};

export function DifficultyBadge({
  value,
}: {
  value: BuildDifficulty | null;
}) {
  const meta = difficultyMeta(value);
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${DIFFICULTY_TONE[meta.value]}`}
    >
      {meta.label}
    </span>
  );
}

const STATUS_STYLES: Record<BuildStatus, string> = {
  pending_review: "bg-badge-pending/15 text-badge-pending",
  approved: "bg-badge-approved/15 text-badge-approved",
  rejected: "bg-badge-rejected/15 text-badge-rejected",
  archived: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: BuildStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function OfficialBadge({ featured }: { featured?: boolean }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary">
      {featured ? "Featured" : "Official"}
    </span>
  );
}

export function TagChips({
  tags,
}: {
  tags: { name: string; slug?: string }[];
}) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.slug ?? tag.name}
          className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}
