import Link from "next/link";
import type { Metadata } from "next";

import { listCharacters, listPerks } from "@/lib/services/assets.service";
import { listRecommendationsAdmin } from "@/lib/services/recommendations.service";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import {
  RecommendationForm,
  type PerkOption,
} from "@/components/admin/recommendation-form";
import {
  deleteRecommendationAction,
  saveRecommendationAction,
  toggleRecommendationAction,
} from "./actions";

export const metadata: Metadata = { title: "Recommendations · Admin" };

export default async function RecommendationsAdminPage({
  searchParams,
}: {
  searchParams: { character?: string };
}) {
  const killers = await listCharacters("killer");
  const selectedId = searchParams.character || killers[0]?.id || "";
  const selected = killers.find((k) => k.id === selectedId) ?? null;

  const [recs, killerPerks] = selected
    ? await Promise.all([
        listRecommendationsAdmin(selected.id),
        listPerks("killer"),
      ])
    : [[], []];

  const perkOptions: PerkOption[] = killerPerks.map((p) => ({
    id: p.id,
    name: p.name,
    icon: p.icon_url,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          Perk recommendations
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Curated, killer-only. These appear as optional suggestions in the build
          form and on killer pages — they never change a build automatically.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {killers.map((k) => (
          <Link
            key={k.id}
            href={`/admin/recommendations?character=${k.id}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              k.id === selectedId
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/40"
            }`}
          >
            {k.name}
          </Link>
        ))}
      </div>

      {!selected ? (
        <p className="text-sm text-muted-foreground">No killers found.</p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <AssetThumb
              src={selected.image_url}
              alt={selected.name}
              fallbackLabel={initialsFrom(selected.name)}
              className="h-10 w-10 rounded"
            />
            <div>
              <h3 className="font-semibold">{selected.name}</h3>
              {selected.power_name ? (
                <p className="text-xs text-muted-foreground">
                  {selected.power_name}
                </p>
              ) : null}
            </div>
          </div>

          {recs.length === 0 ? (
            <p className="rounded-lg border border-border/60 bg-card p-4 text-sm text-muted-foreground">
              No recommendations yet for {selected.name}.
            </p>
          ) : (
            <ul className="space-y-2">
              {recs.map((rec) => (
                <li
                  key={rec.id}
                  className="rounded-lg border border-border/60 bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <AssetThumb
                      src={rec.perkIcon}
                      alt={rec.perkName}
                      fallbackLabel={initialsFrom(rec.perkName)}
                      className="h-8 w-8 rounded"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {rec.perkName}
                        {!rec.isActive ? (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            hidden
                          </span>
                        ) : null}
                      </p>

                      <form
                        action={saveRecommendationAction}
                        className="mt-2 flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="id" value={rec.id} />
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground">
                            Note
                          </label>
                          <input
                            name="note"
                            defaultValue={rec.note ?? ""}
                            className="mt-1 w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">
                            Order
                          </label>
                          <input
                            name="sortOrder"
                            type="number"
                            defaultValue={rec.sortOrder}
                            className="mt-1 w-16 rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                          />
                        </div>
                        <button className="rounded-md border border-border/60 px-3 py-1.5 text-sm hover:border-border">
                          Save
                        </button>
                      </form>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1">
                      <form action={toggleRecommendationAction}>
                        <input type="hidden" name="id" value={rec.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={(!rec.isActive).toString()}
                        />
                        <button className="w-full rounded-md border border-border/60 px-2 py-1 text-xs hover:border-border">
                          {rec.isActive ? "Hide" : "Show"}
                        </button>
                      </form>
                      <form action={deleteRecommendationAction}>
                        <input type="hidden" name="id" value={rec.id} />
                        <button className="w-full rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <RecommendationForm characterId={selected.id} perks={perkOptions} />
        </div>
      )}
    </div>
  );
}
