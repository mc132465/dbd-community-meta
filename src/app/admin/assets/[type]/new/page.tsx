import Link from "next/link";
import { notFound } from "next/navigation";

import { assetConfigs, isAssetType } from "@/lib/admin/asset-config";
import { loadRefOptions } from "@/lib/admin/load-refs";
import { AssetForm } from "@/components/admin/asset-form";

type Params = { params: { type: string } };

export default async function NewAssetPage({ params }: Params) {
  if (!isAssetType(params.type)) notFound();
  const config = assetConfigs[params.type];
  const refOptions = await loadRefOptions(config);

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
          New {config.label.toLowerCase()}
        </h2>
      </div>

      <AssetForm
        type={config.type}
        fields={config.fields}
        refOptions={refOptions}
      />
    </div>
  );
}
