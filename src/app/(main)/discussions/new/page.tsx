import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { listActiveDiscussionCategories } from "@/lib/services/discussions.service";
import { NewThreadForm } from "@/components/discussions/new-thread-form";

export const metadata: Metadata = { title: "Start a discussion" };

export default async function NewDiscussionPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/discussions/new");

  const categories = await listActiveDiscussionCategories();

  return (
    <div className="container max-w-2xl space-y-6 py-12">
      <div>
        <Link
          href="/discussions"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Discussions
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Start a discussion
        </h1>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No categories are available yet.
        </p>
      ) : (
        <NewThreadForm
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}
    </div>
  );
}
