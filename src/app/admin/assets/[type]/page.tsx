import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db/kysely";
import type { DB } from "@/lib/db/types";
import { assetConfigs, isAssetType } from "@/lib/admin/asset-config";
import { Button } from "@/components/ui/button";
import { DeleteAssetButton } from "@/components/admin/delete-asset-button";

type Params = { params: { type: string } };

export default async function AdminAssetListPage({ params }: Params) {
  if (!isAssetType(params.type)) notFound();
  const config = assetConfigs[params.type];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
  const rows = (await (db.selectFrom(config.table as keyof DB) as any)
    .selectAll()
    .orderBy(config.keyColumn)
    .execute()) as Array<Record<string, string>>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/assets"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Assets
          </Link>
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
            {config.labelPlural}
          </h2>
        </div>
        <Button asChild>
          <Link href={`/admin/assets/${config.type}/new`}>
            New {config.label.toLowerCase()}
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No {config.labelPlural.toLowerCase()} yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">
                  {config.keyColumn === "version" ? "Version" : "Name"}
                </th>
                <th className="px-4 py-2 font-medium">{config.keyColumn}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-4 py-2">{row.name ?? row.version}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row[config.keyColumn]}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          href={`/admin/assets/${config.type}/${row.id}/edit`}
                        >
                          Edit
                        </Link>
                      </Button>
                      <DeleteAssetButton
                        type={config.type}
                        id={row.id}
                        name={row.name ?? row.version ?? row[config.keyColumn]}
                      />
                    </div>
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
