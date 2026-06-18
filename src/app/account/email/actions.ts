"use server";

import { revalidatePath } from "next/cache";

import { emailSchema } from "@/lib/validations/auth";
import {
  resendVerification,
  setEmailPrefs,
  setMyEmail,
} from "@/lib/services/email-account.service";

export async function setEmailAction(formData: FormData): Promise<void> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (parsed.success) await setMyEmail(parsed.data);
  revalidatePath("/account");
}

export async function resendVerificationAction(): Promise<void> {
  await resendVerification();
  revalidatePath("/account");
}

export async function setEmailPrefsAction(formData: FormData): Promise<void> {
  const newsletter = formData.get("newsletter") === "on";
  const events = formData.get("events") === "on";
  await setEmailPrefs(newsletter, events);
  revalidatePath("/account");
}
