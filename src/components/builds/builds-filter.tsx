"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Role = "killer" | "survivor";

type CharacterOption = { slug: string; name: string; role: Role };
type TagOption = { slug: string; name: string };

export type BuildsFilterState = {
  q: string;
  role: "" | Role;
  character: string;
  tags: string[];
};

const FIELD =
  "rounded-md border border-border/60 bg-card px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none";

export function BuildsFilter({
  characters,
  tags,
  current,
}: {
  characters: CharacterOption[];
  tags: TagOption[];
  current: BuildsFilterState;
}) {
  const router = useRouter();
  const [q, setQ] = useState(current.q);

  function push(next: BuildsFilterState) {
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.role) params.set("role", next.role);
    if (next.character) params.set("character", next.character);
    if (next.tags.length) params.set("tags", next.tags.join(","));
    const qs = params.toString();
    router.push(qs ? `/builds?${qs}` : "/builds");
  }

  // Changing role clears a character that no longer belongs to that role.
  function setRole(role: "" | Role) {
    const keepChar =
      current.character &&
      characters.some(
        (c) => c.slug === current.character && (!role || c.role === role),
      );
    push({ ...current, role, character: keepChar ? current.character : "" });
  }

  function toggleTag(slug: string) {
    const tagsNext = current.tags.includes(slug)
      ? current.tags.filter((t) => t !== slug)
      : [...current.tags, slug];
    push({ ...current, tags: tagsNext });
  }

  const visibleCharacters = current.role
    ? characters.filter((c) => c.role === current.role)
    : characters;

  const hasFilters =
    !!current.q || !!current.role || !!current.character || current.tags.length > 0;

  const roleTabs: { label: string; value: "" | Role }[] = [
    { label: "All", value: "" },
    { label: "Killers", value: "killer" },
    { label: "Survivors", value: "survivor" },
  ];

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex min-w-[16rem] flex-1 items-center gap-2">
          <input
            className={`${FIELD} flex-1`}
            placeholder="Search builds, killers, survivors, perks, items…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") push({ ...current, q });
            }}
          />
          <button
            type="button"
            className="rounded-md border border-border/60 bg-card px-3 py-2 text-sm font-medium hover:border-border"
            onClick={() => push({ ...current, q })}
          >
            Search
          </button>
        </div>

        {/* Role tabs */}
        <div className="inline-flex overflow-hidden rounded-md border border-border/60">
          {roleTabs.map((t) => {
            const active = current.role === t.value;
            return (
              <button
                key={t.label}
                type="button"
                aria-pressed={active}
                onClick={() => setRole(t.value)}
                className={`px-3 py-2 text-sm ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Character */}
        <select
          className={FIELD}
          value={current.character}
          onChange={(e) => push({ ...current, character: e.target.value })}
        >
          <option value="">
            {current.role === "killer"
              ? "All killers"
              : current.role === "survivor"
                ? "All survivors"
                : "All characters"}
          </option>
          {visibleCharacters.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tags (secondary, inside the panel) */}
      {tags.length > 0 ? (
        <div className="space-y-2 border-t border-border/40 pt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tags
          </span>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = current.tags.includes(tag.slug);
              return (
                <button
                  key={tag.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTag(tag.slug)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40"
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {hasFilters ? (
        <button
          type="button"
          onClick={() => {
            setQ("");
            router.push("/builds");
          }}
          className="text-xs text-link hover:text-link-hover hover:underline"
        >
          Clear all filters
        </button>
      ) : null}
    </div>
  );
}
