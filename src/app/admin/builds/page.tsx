import Link from "next/link";

import {
  countPendingReview,
  getAuthorUsernames,
  listAllBuilds,
} from "@/lib/services/builds.service";
import { Button } from "@/components/ui/button";
import { OfficialBadge, StatusBadge } from "@/components/builds/badges";
import { deleteBuildAction, restoreBuildAction } from "./actions";

export default async function AdminBuildsPage() {
  const [builds, pending] = await Promise.all([
    listAllBuilds(),
    countPendingReview(),
  ]);
  const authors = await getAuthorUsernames(builds.map((b) => b.author_id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
            Builds
          </h2>
          <p className="text-sm text-muted-foreground">
            {builds.length} total · {pending} awaiting review
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/builds/queue">Review queue ({pending})</Link>
        </Button>
      </div>

      {builds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No builds yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Author</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {builds.map((build) => {
                const editorial = Array.isArray(build.build_editorials)
                  ? build.build_editorials[0]
                  : build.build_editorials;
                return (
                  <tr key={build.id} className="border-t border-border/60">
                    <td className="px-4 py-2">
                      <Link
                        href={`/builds/${build.slug}`}
                        className="hover:text-link-hover"
                      >
                        {build.title ||
                          `${build.characters?.name ?? "Build"} loadout`}
                      </Link>
                      {editorial?.published_at ? (
                        <span className="ml-2 align-middle">
                          <OfficialBadge featured={editorial.is_featured} />
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      @{authors[build.author_id] ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={build.status} />
                      {build.deleted_at ? (
                        <span className="ml-2 rounded bg-destructive/15 px-1.5 py-0.5 text-xs text-destructive">
                          Deleted
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/builds/${build.id}/edit`}>
                            Editorial
                          </Link>
                        </Button>
                        {build.deleted_at ? (
                          <form action={restoreBuildAction}>
                            <input type="hidden" name="id" value={build.id} />
                            <button className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                              Restore
                            </button>
                          </form>
                        ) : (
                          <form action={deleteBuildAction}>
                            <input type="hidden" name="id" value={build.id} />
                            <button className="rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                              Delete
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
