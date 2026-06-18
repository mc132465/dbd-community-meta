"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { suggestAction } from "@/components/search/suggest-action";
import type { SearchSuggestion } from "@/lib/services/search.service";

/**
 * Navigation search input. Submitting routes to /search?q=…. As the user types
 * (debounced), it shows a small typeahead dropdown of matching characters, perks,
 * and builds; choosing one navigates directly. Works inline in the navbar and
 * full-width on the results page / mobile menu.
 */
export function SearchBar({
  defaultValue = "",
  className = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced suggestion fetch.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const results = await suggestAction(term);
        if (active) {
          setSuggestions(results);
          setOpen(true);
        }
      } catch {
        if (active) setSuggestions([]);
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(term: string) {
    const t = term.trim();
    if (t.length === 0) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(t)}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    go(q);
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form onSubmit={onSubmit} role="search">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search builds, perks, killers…"
          aria-label="Search the site"
          autoFocus={autoFocus}
          autoComplete="off"
          className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
        />
      </form>

      {open && suggestions.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-80 w-full min-w-[16rem] overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {suggestions.map((s, i) => (
            <li key={`${s.href}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  router.push(s.href);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className="truncate">{s.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {s.sublabel}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
