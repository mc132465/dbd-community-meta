import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db/kysely";
import type { DB } from "@/lib/db/types";
import { assetConfigs, isAssetType } from "@/lib/admin/asset-config";
import { loadRefOptions } from "@/lib/admin/load-refs";
import { AssetForm } from "@/components/admin/asset-form";
import {
  labelsForPerk,
  listActivePerkLabels,
} from "@/lib/services/perk-labels.service";
import { PerkLabelAssigner } from "@/components/admin/perk-label-assigner";

type Params = { params: { type: string; id: string } };

export default async function EditAssetPage({ params }: Params) {
  if (!isAssetType(params.type)) notFound();
  const config = assetConfigs[params.type];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
  const row = (await (db.selectFrom(config.table as keyof DB) as any)
    .selectAll()
    .where("id", "=", params.id)
    .executeTakeFirst()) as Record<string, unknown> | undefined;

  if (!row) notFound();

  const refOptions = await loadRefOptions(config);

  // Build initial values limited to the configured editable fields.
  const initialValues: Record<string, unknown> = {};
  for (const field of config.fields) {
    initialValues[field.name] = (row as Record<string, unknown>)[field.name];
  }

  // Perk-label assignment is only relevant for perks.
  let perkLabelSection: ReactNode = null;
  if (config.type === "perks") {
    const [activeLabels, assigned] = await Promise.all([
      listActivePerkLabels(),
      labelsForPerk(params.id),
    ]);
    perkLabelSection = (
      <PerkLabelAssigner
        perkId={params.id}
        options={activeLabels.map((l) => ({ id: l.id, name: l.name }))}
        assigned={assigned.map((l) => l.id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/assets/${config.type}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {config.labelPlural}
        </Link>
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Edit {config.label.toLowerCase()}
        </h2>
      </div>

      <AssetForm
        type={config.type}
        fields={config.fields}
        refOptions={refOptions}
        initialValues={initialValues}
        id={params.id}
      />

      {perkLabelSection}
    </div>
  );
}
