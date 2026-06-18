import { z } from "zod";

export const TIER_CATEGORIES = [
  "killer_perks",
  "survivor_perks",
  "killers",
  "survivors",
  "maps",
  "other",
] as const;

export type TierCategory = (typeof TIER_CATEGORIES)[number];

const labelArray = z
  .array(z.string().trim().min(1).max(24))
  .min(1, "Add at least one tier label.")
  .max(12, "Too many tier labels.");

export const createTierListSchema = z.object({
  title: z.string().trim().min(3, "Give it a title.").max(160),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  category: z.enum(TIER_CATEGORIES),
  tier_labels: labelArray.optional(),
});

export type CreateTierListInput = z.infer<typeof createTierListSchema>;

export const updateTierListSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  category: z.enum(TIER_CATEGORIES).optional(),
});

export type UpdateTierListInput = z.infer<typeof updateTierListSchema>;

export const tierLabelsSchema = z.object({ labels: labelArray });

export const addEntrySchema = z.object({
  tierListId: z.string().uuid(),
  tier: z.string().trim().min(1).max(24),
  // Exactly one of these identifies the target, by category.
  perkId: z.string().uuid().optional(),
  characterId: z.string().uuid().optional(),
  mapId: z.string().uuid().optional(),
  customLabel: z.string().trim().min(1).max(120).optional(),
});

export type AddEntryInput = z.infer<typeof addEntrySchema>;

export const moveEntrySchema = z.object({
  entryId: z.string().uuid(),
  tier: z.string().trim().min(1).max(24),
  position: z.number().int().min(0).max(100000),
});

export type MoveEntryInput = z.infer<typeof moveEntrySchema>;
