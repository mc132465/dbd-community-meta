import Link from "next/link";
import type { Metadata } from "next";

import {
  recentActivity,
  type ActivityType,
} from "@/lib/services/activity.service";

export const metadata: Metadata = {
  title: "Activity",
  description: "Recent builds, tier lists, and discussions from the community.",
};

const LABEL: Record<ActivityType, string> = {
  build: "Build",
  tier_list: "Tier list",
  discussion: "Discussion",
};

const BADGE: Record<ActivityType, string> = {
  build: "bg-primary/15 text-primary",
  tier_list: "bg-amber-500/15 text-amber-400",
  discussion: "bg-sky-500/15 text-sky-400",
};

function dayLabel(iso: string): string {
  // Stable, locale-independent date for SSR (avoids hydration drift).
  return iso.slice(0, 10);
}

export default async function ActivityPage() {
  const items = await recentActivity(40);

  return (
    <div className="container max-w-2xl space-y-8 py-12">
      <header>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Activity
        </h1>
        <p className="mt-2 text-muted-foreground">
          The latest builds, tier lists, and discussions across Fog Archives.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing yet — new builds, tier lists, and discussions will show up here.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={`${item.type}-${item.href}`}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-border/60 px-4 py-3 transition-colors hover:border-border"
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide ${BADGE[item.type]}`}
                >
                  {LABEL[item.type]}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {dayLabel(item.at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
