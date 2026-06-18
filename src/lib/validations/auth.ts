import { z } from "zod";

/**
 * Validation conventions for the project:
 * - One schema module per domain (auth here; builds, tier-lists, etc. later).
 * - Schemas are the single source of truth for a shape; derive TS types with
 *   `z.infer` rather than declaring types separately.
 * - Reuse shared field schemas (e.g. `usernameSchema`) so rules stay consistent
 *   between the client form, the server action, and the database CHECK.
 * - Server Actions re-validate input with `safeParse` and never trust the client.
 */

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(20, "Username must be at most 20 characters.")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Use only letters, numbers, and underscores.",
  )
  .transform((value) => value.toLowerCase())
  .refine(
    (value) => !value.startsWith("deleted_"),
    "That username prefix is reserved.",
  );

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.");

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(254, "Email is too long.")
  .transform((value) => value.toLowerCase());

export const signUpSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email."),
  password: z.string().min(1, "Enter your password."),
});

export const changeUsernameSchema = z.object({
  username: usernameSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ChangeUsernameInput = z.infer<typeof changeUsernameSchema>;
