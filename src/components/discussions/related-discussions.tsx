import Link from "next/link";

import { listRelatedThreads } from "@/lib/services/discussions.service";

/**
 * Renders a compact "Related discussions" list for a catalog entity, linking to
 * threads that reference it. Renders nothing when there are none. Provide
 * exactly one of perkId / characterId / buildId.
 */
export async function RelatedDiscussions({
  perkId,
  characterId,
  buildId,
  limit = 5,
}: {
  perkId?: string;
  characterId?: string;
  buildId?: string;
  limit?: number;
}) {
  const threads = await listRelatedThreads(
    { perkId, characterId, buildId },
    limit,
  );
  if (threads.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Related discussions
      </h2>
      <ul className="space-y-1">
        {threads.map((t) => (
          <li key={t.slug} className="text-sm">
            <Link
              href={`/discussions/${t.slug}`}
              className="text-link hover:text-link-hover hover:underline"
            >
              {t.title}
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">
              {t.replyCount} {t.replyCount === 1 ? "reply" : "replies"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
