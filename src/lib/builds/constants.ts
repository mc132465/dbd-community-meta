import type { BuildDifficulty, BuildStatus } from "@/types/database";

export const DIFFICULTIES: {
  value: BuildDifficulty;
  label: string;
  emoji: string;
}[] = [
  { value: "beginner", label: "Beginner", emoji: "🟢" },
  { value: "intermediate", label: "Intermediate", emoji: "🟡" },
  { value: "advanced", label: "Advanced", emoji: "🔴" },
];

export const STATUS_LABELS: Record<BuildStatus, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  archived: "Archived",
};

export function difficultyMeta(value: BuildDifficulty | null) {
  return DIFFICULTIES.find((d) => d.value === value) ?? null;
}

/** Build a slug from a title (or fallback) plus a short unique suffix. */
export function buildSlug(base: string): string {
  const root =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "build";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${root}-${suffix}`;
}

/** Plain slug (no random suffix) for tags/categories. */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "tag"
  );
}
