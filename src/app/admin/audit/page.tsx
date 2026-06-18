import type { Metadata } from "next";
import Link from "next/link";

import { listAuditEntityTypes, listAuditLog } from "@/lib/services/audit.service";

export const metadata: Metadata = { title: "Audit log · Admin" };

type Search = { searchParams: { type?: string } };

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export default async function AuditLogPage({ searchParams }: Search) {
  const type = searchParams.type || undefined;
  const [entries, types] = await Promise.all([
    listAuditLog({ entityType: type, limit: 200 }),
    listAuditEntityTypes(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          Audit log
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Append-only history of staff actions: approvals, rejections, asset
          review decisions, and other admin changes. Most recent first.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href="/admin/audit"
          className={`rounded-full border px-3 py-1 ${
            !type
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </Link>
        {types.map((t) => (
          <Link
            key={t}
            href={`/admin/audit?type=${encodeURIComponent(t)}`}
            className={`rounded-full border px-3 py-1 ${
              type === t
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          No audit entries yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Entity</th>
                <th className="px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const meta = e.metadata && Object.keys(e.metadata).length > 0
                  ? JSON.stringify(e.metadata)
                  : "";
                return (
                  <tr key={e.id} className="border-t border-border/40 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {when(e.createdAt)}
                    </td>
                    <td className="px-3 py-2">{e.actorName ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{e.action}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {e.entityType}
                      {e.entityId ? (
                        <span className="ml-1 font-mono text-xs">
                          {e.entityId.slice(0, 8)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {meta}
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
