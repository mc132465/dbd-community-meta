"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  resolveAssetSrc,
  type AssetCategory,
} from "@/lib/assets/resolve";

type Props = {
  /** Explicit override URL (DB icon_url/image_url). Takes precedence. */
  src?: string | null;
  alt: string;
  /** Initials/short label shown when there is no image (or it fails to load). */
  fallbackLabel?: string;
  className?: string;
  /** Convention resolution: if `src` is null, use /assets/<category>/<slug>.png. */
  category?: AssetCategory;
  slug?: string | null;
};

/**
 * Renders an asset image, or a neutral fallback. The effective source is the
 * explicit `src` override if set, otherwise the conventional path derived from
 * `category` + `slug`. If the resolved file is missing (or fails to load), it
 * degrades gracefully to the initials fallback — so "if a PNG exists, it shows;
 * if not, you get a clean placeholder" without any DB mapping.
 */
export function AssetThumb({
  src = null,
  alt,
  fallbackLabel,
  className,
  category,
  slug,
}: Props) {
  const [failed, setFailed] = useState(false);
  const resolved = category
    ? resolveAssetSrc(src, category, slug)
    : (src ?? null);

  if (resolved && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={alt}
        onError={() => setFailed(true)}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground",
        className,
      )}
      aria-label={`${alt} (no image)`}
      role="img"
    >
      {fallbackLabel ? (
        <span className="font-display text-lg font-semibold uppercase tracking-wide">
          {fallbackLabel}
        </span>
      ) : (
        <ImageOff className="h-5 w-5" aria-hidden />
      )}
    </div>
  );
}

/** Short label (initials) derived from a name, for the fallback. */
export function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}
