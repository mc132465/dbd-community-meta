"use server";

import {
  signInWithUsername,
  signOut,
  signUpWithUsername,
  type AuthResult,
} from "@/lib/services/auth.service";
import { signInSchema, signUpSchema } from "@/lib/validations/auth";

export async function signUpAction(input: unknown): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  return signUpWithUsername(parsed.data);
}

export async function signInAction(input: unknown): Promise<AuthResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  return signInWithUsername(parsed.data);
}

export async function signOutAction(): Promise<void> {
  await signOut();
}
