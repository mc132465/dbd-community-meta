"use server";

import { changeUsername } from "@/lib/services/auth.service";
import { changeUsernameSchema } from "@/lib/validations/auth";

export type ChangeUsernameResult = { ok: true } | { ok: false; error: string };

export async function changeUsernameAction(
  input: unknown,
): Promise<ChangeUsernameResult> {
  const parsed = changeUsernameSchema.safeParse(input);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Please choose a valid username.";
    return { ok: false, error: message };
  }
  return changeUsername(parsed.data);
}
