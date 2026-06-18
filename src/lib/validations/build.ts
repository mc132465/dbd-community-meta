import { z } from "zod";

const uuid = z.string().uuid();
const difficulty = z.enum(["beginner", "intermediate", "advanced"]);

/**
 * Community submission — STRUCTURED DATA ONLY. Tags are referenced by id
 * (database-managed). No editorial fields here.
 */
export const communityBuildSchema = z.object({
  title: z.string().trim().max(80).optional().or(z.literal("")),
  role: z.enum(["killer", "survivor"]),
  character_id: uuid,
  difficulty_suggestion: difficulty.optional().or(z.literal("")),
  tag_ids: z.array(uuid).max(12).default([]),
  perk_ids: z.array(uuid).min(1, "Pick at least one perk.").max(4),
  add_on_ids: z.array(uuid).max(2).default([]),
  item_id: uuid.optional().or(z.literal("")),
});

export type CommunityBuildInput = z.infer<typeof communityBuildSchema>;

/** Community comment on a build (Phase 3). Body length mirrors the DB CHECK. */
export const commentSchema = z.object({
  build_id: uuid,
  body: z
    .string()
    .trim()
    .min(1, "Comment can't be empty.")
    .max(2000, "Comment must be 2000 characters or fewer."),
});

export type CommentInput = z.infer<typeof commentSchema>;

/**
 * Editorial layer — STAFF ONLY. Official tags are referenced by id.
 */
export const editorialSchema = z.object({
  overall_strategy: z.string().trim().optional().or(z.literal("")),
  strengths: z.string().trim().optional().or(z.literal("")),
  weaknesses: z.string().trim().optional().or(z.literal("")),
  recommended_difficulty: difficulty.optional().or(z.literal("")),
  official_tag_ids: z.array(uuid).max(12).default([]),
  is_featured: z.boolean().default(false),
  published: z.boolean().default(false),
  perk_reasons: z
    .array(z.object({ slot: z.number().int().min(1).max(4), reason: z.string() }))
    .default([]),
});

export type EditorialInput = z.infer<typeof editorialSchema>;

export const reviewSchema = z.object({
  action: z.enum(["approve", "reject", "archive"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

/** Admin tag-management schemas. */
export const tagSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(40),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only.")
    .optional()
    .or(z.literal("")),
  category_id: uuid.optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export type TagInput = z.infer<typeof tagSchema>;

export const tagCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(40),
  sort_order: z.number().int().min(0).default(0),
});

export type TagCategoryInput = z.infer<typeof tagCategorySchema>;

export const perkLabelSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(40),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only.")
    .optional()
    .or(z.literal("")),
  category_id: uuid.optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export type PerkLabelInput = z.infer<typeof perkLabelSchema>;

export const perkLabelCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(40),
  sort_order: z.number().int().min(0).default(0),
});

export type PerkLabelCategoryInput = z.infer<typeof perkLabelCategorySchema>;
