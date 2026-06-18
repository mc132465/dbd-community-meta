import Link from "next/link";
import type { Metadata } from "next";

import {
  ASSET_TYPES,
  assetCoverageSummary,
  listAssetMappings,
  type MappingFilter,
} from "@/lib/services/asset-mapping.service";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";

export const metadata: Metadata = { title: "Asset mapping · Admin" };

const STATUSES: { key: NonNullable<MappingFilter["status"]>; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mapped", label: "Mapped" },
  { key: "unmapped", label: "Unmapped" },
  { key: "manual", label: "Manual" },
];

function pct(n: number, d: number): string {
  if (d === 0) return "n/a";
  return `${Math.round((n / d) * 1000) / 10}%`;
}

function href(type: string | undefined, status: string | undefined): string {
  const p = new URLSearchParams();
  if (type) p.set("type", type);
  if (status && status !== "all") p.set("status", status);
  const qs = p.toString();
  return qs ? `/admin/assets/mapping?${qs}` : "/admin/assets/mapping";
}

export default async function AssetMappingPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string };
}) {
  const type = ASSET_TYPES.includes(
    (searchParams.type ?? "") as (typeof ASSET_TYPES)[number],
  )
    ? searchParams.type
    : undefined;
  const status = (["mapped", "unmapped", "manual"] as const).includes(
    (searchParams.status ?? "") as "mapped" | "unmapped" | "manual",
  )
    ? (searchParams.status as "mapped" | "unmapped" | "manual")
    : "all";

  const [summary, rows] = await Promise.all([
    assetCoverageSummary(),
    listAssetMappings({ assetType: type, status, limit: 300 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          Asset mapping
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Live view of imported assets and how they map to catalog entities. For
          the full report run <code>pnpm diagnose:assets</code>.
        </p>
      </div>

      {/* Coverage summary */}
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">DB entries</th>
              <th className="px-3 py-2 text-right">DB w/ image</th>
              <th className="px-3 py-2 text-right">Imported</th>
              <th className="px-3 py-2 text-right">Mapped</th>
              <th className="px-3 py-2 text-right">Unmapped</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.key} className="border-t border-border/40">
                <td className="px-3 py-2 font-medium">{s.key}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.dbEntries}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s.dbWithImage}{" "}
                  <span className="text-muted-foreground">
                    ({pct(s.dbWithImage, s.dbEntries)})
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{s.imported}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.mapped}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s.unmapped > 0 ? (
                    <span className="text-amber-400">{s.unmapped}</span>
                  ) : (
                    s.unmapped
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-1">
          <Link
            href={href(undefined, status)}
            className={`rounded-md px-2.5 py-1 text-xs ${
              !type ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            All types
          </Link>
          {ASSET_TYPES.map((t) => (
            <Link
              key={t}
              href={href(t, status)}
              className={`rounded-md px-2.5 py-1 text-xs ${
                type === t
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <Link
              key={s.key}
              href={href(type, s.key)}
              className={`rounded-md px-2.5 py-1 text-xs ${
                status === s.key
                  ? "border border-foreground text-foreground"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Mapping list */}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          No asset images match this filter. If everything is empty, no pack has
          been imported yet — run the import from Admin → Import.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Preview</th>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Pack</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Target entity</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Mode</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-3 py-2">
                    <AssetThumb
                      src={r.imageUrl}
                      alt={r.sourceFile}
                      fallbackLabel={initialsFrom(r.sourceFile)}
                      className="h-9 w-9 rounded"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.sourceFile}</div>
                    {r.derivedSlug ? (
                      <div className="text-xs text-muted-foreground">
                        {r.derivedSlug}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.packName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.assetType}</td>
                  <td className="px-3 py-2">
                    {r.targetName ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.mapped ? (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-400">
                        mapped
                      </span>
                    ) : (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-400">
                        unmapped
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.mappingMode}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
