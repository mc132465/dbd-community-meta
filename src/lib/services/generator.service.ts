import "server-only";

import type { GameRole } from "@/types/database";
import { listPerks } from "@/lib/services/assets.service";
import {
  getActiveLabelsBySlugs,
  labelsByPerkIds,
} from "@/lib/services/perk-labels.service";
import { ownedPerkIdSet } from "@/lib/services/owned-perks.service";

/**
 * Logical Build Generator (NOT a randomizer). Builds a coherent, role-scoped
 * 4-perk loadout by scoring perks against the user's selected labels, biased
 * toward Meta perks. Read-only — never writes to the database. A separate
 * Randomizer mode is intentionally out of scope here.
 */

const BUILD_SIZE = 4;
const LABEL_MATCH_SCORE = 10; // per selected label a perk carries
const META_BONUS = 3; // perk carries the "meta" label
const META_SLUG = "meta";

export type GeneratorInput = {
  role: GameRole;
  labelSlugs: string[];
  ownedOnly?: boolean;
  userId?: string | null;
  lockedPerkIds?: string[];
  seed?: number;
};

export type GeneratedPerk = {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  matchedLabels: string[]; // names of selected labels this perk carries
  isMeta: boolean;
  score: number;
  locked: boolean;
  reason: string;
};

export type GeneratorResult =
  | { ok: true; perks: GeneratedPerk[]; explanation: string }
  | { ok: false; error: string; matched: number; needed: number };

/** Deterministic per-seed tie-break so rerolls vary without driving selection. */
function tiebreak(id: string, seed: number): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function perkReason(matchedLabels: string[], isMeta: boolean, locked: boolean): string {
  if (locked) {
    const base =
      matchedLabels.length > 0
        ? `Locked by you · matches ${matchedLabels.join(", ")}`
        : "Locked by you";
    return base;
  }
  const parts: string[] = [];
  if (matchedLabels.length > 0) parts.push(`Matches ${matchedLabels.join(", ")}`);
  if (isMeta) parts.push("Meta pick");
  return parts.join(" · ") || "Selected for fit";
}

export async function generateBuild(
  input: GeneratorInput,
): Promise<GeneratorResult> {
  const {
    role,
    labelSlugs,
    ownedOnly = false,
    userId = null,
    lockedPerkIds = [],
    seed = 0,
  } = input;

  // Resolve selected labels to active ones (drops unknown/disabled slugs).
  const selectedSlugs = [...new Set(labelSlugs.map((s) => s.trim()).filter(Boolean))];
  const selectedLabels = await getActiveLabelsBySlugs(selectedSlugs);
  if (selectedLabels.length === 0) {
    return {
      ok: false,
      error: "Select at least one active label to generate a build.",
      matched: 0,
      needed: BUILD_SIZE,
    };
  }
  const selectedSlugSet = new Set(selectedLabels.map((l) => l.slug));
  const nameBySlug = new Map(selectedLabels.map((l) => [l.slug, l.name] as const));

  // Role-scoped candidate pool.
  let pool = await listPerks(role);

  // Ownership filter applied to the POOL before scoring (never a post-filter).
  if (ownedOnly) {
    const owned = userId ? await ownedPerkIdSet(userId) : new Set<string>();
    pool = pool.filter((p) => owned.has(p.id));
    if (pool.length === 0) {
      return {
        ok: false,
        error:
          "You haven't marked enough owned perks. Add owned perks in My Perks or turn off the owned-only option.",
        matched: 0,
        needed: BUILD_SIZE,
      };
    }
  }

  // Labels for every candidate, in one query.
  const labelMap = await labelsByPerkIds(pool.map((p) => p.id));

  // Score each candidate.
  const lockedSet = new Set(lockedPerkIds);
  const scored = pool.map((p) => {
    const slugs = (labelMap[p.id] ?? []).map((l) => l.slug);
    const matchedSlugs = slugs.filter((s) => selectedSlugSet.has(s));
    const matchedLabels = matchedSlugs.map((s) => nameBySlug.get(s) as string);
    const isMeta = slugs.includes(META_SLUG);
    const score =
      matchedSlugs.length * LABEL_MATCH_SCORE + (isMeta ? META_BONUS : 0);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      iconUrl: p.icon_url,
      matchedLabels,
      isMeta,
      score,
      locked: lockedSet.has(p.id),
    };
  });

  const byScore = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    b.score - a.score || tiebreak(a.id, seed) - tiebreak(b.id, seed);

  // Locked perks are kept regardless of label match (user pinned them), as long
  // as they're in the role-scoped (and owned, if enabled) pool.
  const lockedSelected = scored.filter((p) => p.locked).sort(byScore);

  // Valid fillers: carry at least one selected label, and not already locked.
  const validFillers = scored
    .filter((p) => !p.locked && p.matchedLabels.length > 0)
    .sort(byScore);

  const chosen = [...lockedSelected];
  for (const f of validFillers) {
    if (chosen.length >= BUILD_SIZE) break;
    chosen.push(f);
  }
  const finalChosen = chosen.slice(0, BUILD_SIZE);

  if (finalChosen.length < BUILD_SIZE) {
    return {
      ok: false,
      error:
        "Not enough matching perks for these criteria. Add more perk labels (admin), loosen your selection, or — if owned-only is on — mark more owned perks.",
      matched: finalChosen.length,
      needed: BUILD_SIZE,
    };
  }

  const perks: GeneratedPerk[] = finalChosen.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    iconUrl: p.iconUrl,
    matchedLabels: p.matchedLabels,
    isMeta: p.isMeta,
    score: p.score,
    locked: p.locked,
    reason: perkReason(p.matchedLabels, p.isMeta, p.locked),
  }));

  // Overall explanation.
  const criteria = selectedLabels.map((l) => l.name);
  const metaCount = perks.filter((p) => p.isMeta).length;
  const roleWord = role === "killer" ? "Killer" : "Survivor";
  const criteriaText =
    criteria.length === 1
      ? criteria[0]
      : `${criteria.slice(0, -1).join(", ")} and ${criteria[criteria.length - 1]}`;
  let explanation = `This ${roleWord} build focuses on ${criteriaText}.`;
  if (metaCount > 0) {
    explanation += ` It leans on ${metaCount} Meta perk${metaCount > 1 ? "s" : ""}.`;
  }
  if (lockedSelected.length > 0) {
    explanation += ` ${lockedSelected.length} perk${lockedSelected.length > 1 ? "s were" : " was"} locked by you.`;
  }

  return { ok: true, perks, explanation };
}
