import Link from "next/link";
import type { Metadata } from "next";

import { listCharacters } from "@/lib/services/assets.service";
import { AssetCard, RoleBadge } from "@/components/assets/asset-card";
import type { CharacterRow, GameRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Characters",
  description: "Killers and survivors.",
};

type RoleTab = "all" | GameRole;
type Sort = "name" | "name_desc" | "newest";

const SORTS: { key: Sort; label: string }[] = [
  { key: "name", label: "Name A–Z" },
  { key: "name_desc", label: "Name Z–A" },
  { key: "newest", label: "Newest" },
];

const ROLE_TABS: { key: RoleTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "killer", label: "Killers" },
  { key: "survivor", label: "Survivors" },
];

type State = { role: RoleTab; sort: Sort; realm: string };

function hrefFor(next: State): string {
  const params = new URLSearchParams();
  if (next.role !== "all") params.set("role", next.role);
  if (next.sort !== "name") params.set("sort", next.sort);
  if (next.realm) params.set("realm", next.realm);
  const qs = params.toString();
  return qs ? `/characters?${qs}` : "/characters";
}

function sortCharacters(list: CharacterRow[], sort: Sort): CharacterRow[] {
  const copy = [...list];
  if (sort === "newest") {
    copy.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  } else if (sort === "name_desc") {
    copy.sort((a, b) => b.name.localeCompare(a.name));
  } else {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  return copy;
}

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: { role?: string; sort?: string; realm?: string };
}) {
  const role: RoleTab =
    searchParams.role === "killer" || searchParams.role === "survivor"
      ? searchParams.role
      : "all";
  const sort: Sort =
    searchParams.sort === "name_desc" || searchParams.sort === "newest"
      ? searchParams.sort
      : "name";
  const realm = (searchParams.realm ?? "").trim();

  const characters =
    role === "all" ? await listCharacters() : await listCharacters(role);

  const realms = [
    ...new Set(characters.map((c) => c.home_realm).filter(Boolean) as string[]),
  ].sort();

  let filtered = characters;
  if (realm) filtered = filtered.filter((c) => c.home_realm === realm);
  const list = sortCharacters(filtered, sort);

  const state: State = { role, sort, realm };

  return (
    <div className="container space-y-8 py-12">
      <header>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Characters
        </h1>
        <p className="mt-2 text-muted-foreground">
          Browse killers and survivors.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-lg border border-border/60 p-1">
          {ROLE_TABS.map((t) => (
            <Link
              key={t.key}
              href={hrefFor({ ...state, role: t.key })}
              className={`rounded-md px-3 py-1.5 text-sm ${
                role === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort:</span>
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={hrefFor({ ...state, sort: s.key })}
              className={`rounded-md px-2 py-1 ${
                sort === s.key
                  ? "border border-border text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Realm filter (GET form preserves role + sort). */}
      {realms.length > 0 ? (
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 p-3 text-sm"
        >
          {role !== "all" ? (
            <input type="hidden" name="role" value={role} />
          ) : null}
          {sort !== "name" ? (
            <input type="hidden" name="sort" value={sort} />
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Realm</span>
            <select
              name="realm"
              defaultValue={realm}
              className="h-9 rounded-md border border-border bg-background px-2"
            >
              <option value="">All realms</option>
              {realms.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button className="h-9 rounded-md bg-primary px-3 font-medium text-primary-foreground">
            Apply
          </button>
          {realm !== "" ? (
            <Link
              href={hrefFor({ role, sort, realm: "" })}
              className="h-9 rounded-md border border-border px-3 leading-9 text-muted-foreground hover:text-foreground"
            >
              Clear
            </Link>
          ) : null}
        </form>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {list.length} {list.length === 1 ? "character" : "characters"}
      </p>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {realm !== ""
            ? "No characters match the selected realm."
            : "No characters yet. Run the importer (`pnpm import:game`)."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {list.map((c) => (
            <AssetCard
              key={c.id}
              href={`/characters/${c.slug}`}
              name={c.name}
              subtitle={c.title}
              imageUrl={c.image_url}
              badge={<RoleBadge role={c.role} />}
            />
          ))}
        </div>
      )}
    </div>
  );
}
