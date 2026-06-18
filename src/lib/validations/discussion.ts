import { z } from "zod";

const uuid = z.string().uuid();
const optionalUuid = uuid.optional().or(z.literal("")).or(z.null());

export const createThreadSchema = z.object({
  title: z.string().trim().min(3, "Give it a clear title.").max(160),
  body: z.string().trim().min(1, "Add some detail.").max(20000),
  category_id: uuid,
  // Optional related references.
  perk_id: optionalUuid,
  character_id: optionalUuid,
  build_id: optionalUuid,
  tag_ids: z.array(uuid).max(8).optional(),
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;

export const updateThreadSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(20000),
  category_id: uuid,
  perk_id: optionalUuid,
  character_id: optionalUuid,
  build_id: optionalUuid,
  tag_ids: z.array(uuid).max(8).optional(),
});

export type UpdateThreadInput = z.infer<typeof updateThreadSchema>;

export const replyBodySchema = z.object({
  body: z.string().trim().min(1, "Write a reply.").max(4000),
});

export type ReplyBodyInput = z.infer<typeof replyBodySchema>;

export const reportReasonSchema = z.object({
  reason: z.string().trim().min(1, "Tell us what's wrong.").max(1000),
});

export type ReportReasonInput = z.infer<typeof reportReasonSchema>;

export const voteValueSchema = z
  .number()
  .int()
  .refine((v) => v === 1 || v === -1, "Vote must be +1 or -1.");
