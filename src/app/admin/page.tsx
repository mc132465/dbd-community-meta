import Link from "next/link";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { countPendingReview } from "@/lib/services/builds.service";
import {
  getDashboardStats,
  getRecentActivity,
} from "@/lib/services/dashboard-stats.service";

export const metadata = { title: "Dashboard · Admin" };

const STATS: {
  key: keyof Awaited<ReturnType<typeof getDashboardStats>>;
  label: string;
  href?: string;
  emphasize?: boolean;
}[] = [
  { key: "users", label: "Users", href: "/admin/users" },
  { key: "builds", label: "Builds" },
  { key: "tierLists", label: "Tier lists" },
  { key: "comments", label: "Comments" },
  {
    key: "missingAssets",
    label: "Missing assets",
    href: "/admin/assets/packs",
    emphasize: true,
  },
  {
    key: "unmappedAssets",
    label: "Unmapped assets",
    href: "/admin/assets/packs",
    emphasize: true,
  },
];

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default async function AdminDashboardPage() {
  const [profile, pending, stats, activity] = await Promise.all([
    getCurrentProfile(),
    countPendingReview(),
    getDashboardStats(),
    getRecentActivity(8),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              @{profile?.username}
            </span>{" "}
            · <span className="capitalize">{profile?.role}</span>
          </p>
        </div>
        {pending > 0 ? (
          <Link
            href="/admin/builds/queue"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            {pending} build{pending === 1 ? "" : "s"} awaiting review
          </Link>
        ) : null}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATS.map((s) => {
          const value = stats[s.key];
          const highlight = s.emphasize && value > 0;
          const inner = (
            <div
              className={`rounded-lg border p-4 ${
                highlight
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/60"
              }`}
            >
              <div
                className={`font-display text-2xl font-bold ${
                  highlight ? "text-primary" : ""
                }`}
              >
                {value}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {s.label}
              </div>
            </div>
          );
          return s.href ? (
            <Link key={s.key} href={s.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={s.key}>{inner}</div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <section className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Recent activity
          </h3>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <Link
                      href={a.href}
                      className="truncate text-sm font-medium text-link hover:text-link-hover hover:underline"
                    >
                      {a.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{a.type}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Quick links */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Quick links
          </h3>
          <div className="grid gap-2">
            {[
              { href: "/admin/builds/queue", label: "Review queue" },
              { href: "/admin/assets", label: "Manage assets" },
              { href: "/admin/assets/packs", label: "Asset packs" },
              { href: "/admin/theme", label: "Theme" },
              { href: "/admin/settings", label: "Site content" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md border border-border/60 px-3 py-2 text-sm transition-colors hover:border-border"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
