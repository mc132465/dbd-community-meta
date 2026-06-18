import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { NewTierListForm } from "@/components/tier-lists/new-tier-list-form";

export const metadata: Metadata = { title: "New tier list" };

export default async function NewTierListPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/tier-lists/new");

  return (
    <div className="container max-w-2xl space-y-6 py-12">
      <div>
        <Link
          href="/tier-lists"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Tier Lists
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          New tier list
        </h1>
      </div>
      <NewTierListForm />
    </div>
  );
}
