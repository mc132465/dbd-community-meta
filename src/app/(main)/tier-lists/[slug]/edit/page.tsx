import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentProfile } from "@/lib/services/profile.service";
import {
  getEditableTierListBySlug,
  listTargetPool,
} from "@/lib/services/tier-list-editor.service";
import { TierListSettings } from "@/components/tier-lists/tier-list-settings";
import { TierListBoard } from "@/components/tier-lists/tier-list-board";

export const metadata: Metadata = { title: "Edit tier list" };

export default async function EditTierListPage({
  params,
}: {
  params: { slug: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=/tier-lists/${params.slug}/edit`);

  const list = await getEditableTierListBySlug(params.slug);
  if (!list) notFound();

  const pool = await listTargetPool(list.category);

  return (
    <div className="container max-w-4xl space-y-8 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/tier-lists"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Tier Lists
          </Link>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
            {list.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            Category: {list.category} · {list.status}
          </p>
        </div>
        {list.status === "published" ? (
          <Link
            href={`/tier-lists/${list.slug}`}
            className="text-sm text-link hover:text-link-hover hover:underline"
          >
            View public page →
          </Link>
        ) : null}
      </div>

      <section className="rounded-lg border border-border/60 p-4">
        <TierListSettings
          tierListId={list.id}
          slug={list.slug}
          title={list.title}
          description={list.description}
          status={list.status}
          labels={list.tierLabels}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Board
        </h2>
        <TierListBoard
          tierListId={list.id}
          slug={list.slug}
          category={list.category}
          tierLabels={list.tierLabels}
          entries={list.entries}
          pool={pool}
        />
      </section>
    </div>
  );
}
