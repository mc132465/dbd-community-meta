import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getRevisionById } from "@/lib/services/build-revisions.service";
import {
  listAddOns,
  listCharacters,
  listItems,
  listPerks,
} from "@/lib/services/assets.service";
import { listActiveTags } from "@/lib/services/tags.service";
import type { BuildRevisionContent } from "@/types/database";
import {
  approveRevisionAction,
  rejectRevisionAction,
} from "../actions";

export const metadata: Metadata = { title: "Review revision · Admin" };

type Resolved = {
  title: string;
  role: string;
  character: string;
  difficulty: string;
  item: string;
  perks: string[];
  addOns: string[];
  tags: string[];
};

function resolve(
  c: BuildRevisionContent | null,
  maps: {
    chars: Map<string, string>;
    perks: Map<string, string>;
    items: Map<string, string>;
    addOns: Map<string, string>;
    tags: Map<string, string>;
  },
): Resolved | null {
  if (!c) return null;
  const name = (m: Map<string, string>, id: string) => m.get(id) ?? "(removed)";
  return {
    title: c.title || "(untitled)",
    role: c.role,
    character: c.character_id ? name(maps.chars, c.character_id) : "—",
    difficulty: c.difficulty_suggestion || "—",
    item: c.item_id ? name(maps.items, c.item_id) : "—",
    perks: c.perk_ids.map((id) => name(maps.perks, id)),
    addOns: c.add_on_ids.map((id) => name(maps.addOns, id)),
    tags: c.tag_ids.map((id) => name(maps.tags, id)),
  };
}

function Column({ heading, r }: { heading: string; r: Resolved | null }) {
  return (
    <div className="flex-1 space-y-2 rounded-lg border border-border/60 bg-card p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </h3>
      {!r ? (
        <p className="text-sm text-muted-foreground">No snapshot.</p>
      ) : (
        <dl className="space-y-1 text-sm">
          <Field label="Title" value={r.title} />
          <Field label="Side" value={r.role} />
          <Field label="Character" value={r.character} />
          <Field label="Difficulty" value={r.difficulty} />
          <Field label="Item" value={r.item} />
          <Field label="Perks" value={r.perks.join(", ") || "—"} />
          <Field label="Add-ons" value={r.addOns.join(", ") || "—"} />
          <Field label="Tags" value={r.tags.join(", ") || "—"} />
        </dl>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}

export default async function ReviewRevisionPage({
  params,
}: {
  params: { id: string };
}) {
  const rev = await getRevisionById(params.id);
  if (!rev) notFound();

  const [chars, perks, items, addOns, tags] = await Promise.all([
    listCharacters(),
    listPerks(),
    listItems(),
    listAddOns(),
    listActiveTags(),
  ]);
  const maps = {
    chars: new Map(chars.map((c) => [c.id, c.name])),
    perks: new Map(perks.map((p) => [p.id, p.name])),
    items: new Map(items.map((i) => [i.id, i.name])),
    addOns: new Map(addOns.map((a) => [a.id, a.name])),
    tags: new Map(tags.map((t) => [t.id, t.name])),
  };

  const before = resolve(rev.base_snapshot, maps);
  const after = resolve(rev.content, maps);
  const open = rev.status === "pending_review";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          Review revision
        </h2>
        <Link
          href="/admin/builds/revisions"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Queue
        </Link>
      </div>

      {!open ? (
        <p className="rounded-md border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground">
          This revision is {rev.status.replace("_", " ")} and can no longer be
          actioned.
        </p>
      ) : null}

      {rev.author_note ? (
        <p className="rounded-md border border-border/60 bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">Author note: </span>
          {rev.author_note}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row">
        <Column heading="Current (at submission)" r={before} />
        <Column heading="Proposed" r={after} />
      </div>

      {open ? (
        <form className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
          <input type="hidden" name="id" value={rev.id} />
          <label className="block text-sm font-medium" htmlFor="note">
            Review note (optional)
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
            placeholder="Shown in the revision record."
          />
          <div className="flex gap-3">
            <button
              formAction={approveRevisionAction}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Approve &amp; apply
            </button>
            <button
              formAction={rejectRevisionAction}
              className="rounded-md border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              Reject
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
