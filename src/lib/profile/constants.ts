// Shared profile constants (safe for both server and client imports — no
// server-only side effects). Picks/tags are validated against these lists.

import type { ProfilePickKind } from "@/types/database";

export const PLAYSTYLE_TAGS = [
  { key: "killer-main", label: "Killer Main" },
  { key: "survivor-main", label: "Survivor Main" },
  { key: "casual", label: "Casual" },
  { key: "competitive", label: "Competitive" },
  { key: "stealth", label: "Stealth" },
  { key: "chase", label: "Chase" },
  { key: "team-player", label: "Team Player" },
  { key: "solo-queue", label: "Solo Queue" },
] as const;

export const PLAYSTYLE_KEYS: string[] = PLAYSTYLE_TAGS.map((t) => t.key);

export function playstyleLabel(key: string): string {
  return PLAYSTYLE_TAGS.find((t) => t.key === key)?.label ?? key;
}

// Preset avatars shipped as static SVGs under public/avatars/. Custom uploads
// are intentionally not supported; avatar_url stores one of these paths.
export const PRESET_AVATARS: string[] = [
  "/avatars/avatar-01.svg",
  "/avatars/avatar-02.svg",
  "/avatars/avatar-03.svg",
  "/avatars/avatar-04.svg",
  "/avatars/avatar-05.svg",
  "/avatars/avatar-06.svg",
  "/avatars/avatar-07.svg",
  "/avatars/avatar-08.svg",
];

export function isPresetAvatar(url: string | null | undefined): boolean {
  return !!url && PRESET_AVATARS.includes(url);
}

// Per-kind selection caps (app-enforced; the DB stores rows, not limits).
export const PICK_CAPS: Record<ProfilePickKind, number> = {
  fav_killer: 3,
  hated_killer: 1,
};

export const PICK_KINDS: ProfilePickKind[] = ["fav_killer", "hated_killer"];
