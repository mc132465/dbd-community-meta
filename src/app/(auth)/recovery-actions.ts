"use server";

import { redirect } from "next/navigation";

import { emailSchema } from "@/lib/validations/auth";
import {
  confirmSelfDeletion,
  requestPasswordReset,
  requestRestore,
  resetPassword,
  restoreAccount,
} from "@/lib/services/account-recovery.service";

export async function requestResetAction(formData: FormData): Promise<void> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (parsed.success) await requestPasswordReset(parsed.data);
  redirect("/forgot?sent=1");
}

export async function resetAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) {
    redirect(`/reset?token=${encodeURIComponent(token)}&error=match`);
  }
  const res = await resetPassword(token, password);
  redirect(
    res.ok ? "/login?reset=1" : `/reset?token=${encodeURIComponent(token)}&error=invalid`,
  );
}

export async function requestRestoreAction(formData: FormData): Promise<void> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (parsed.success) await requestRestore(parsed.data);
  redirect("/restore?sent=1");
}

export async function restoreAccountAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const res = await restoreAccount(token);
  redirect(res.ok ? "/login?restored=1" : "/restore?error=1");
}

export async function confirmDeleteAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const res = await confirmSelfDeletion(token);
  redirect(res.ok ? "/?deleted=1" : "/confirm-delete?error=1");
}
