"use server";

import { redirect } from "next/navigation";

import { requestSelfDeletion } from "@/lib/services/account-recovery.service";

export async function requestSelfDeletionAction(): Promise<void> {
  const res = await requestSelfDeletion();
  redirect(res.ok ? "/account?deletion=sent" : "/account?deletion=noemail");
}
