import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";

/**
 * Runtime-configurable site settings (theme colors + small texts), stored as
 * key/value rows in site_settings. Theme values are stored as hex (admin-
 * friendly) and converted to HSL triples for injection into the existing
 * `hsl(var(--x))` design tokens. Reads are cached and tag-invalidated on save.
 */

export type ThemeSettings = {
  accent: string; // main brand accent → --primary, --ring
  button: string; // buttons → --button (separate from accent)
  link: string; // links / clickable text → --link
  linkHover: string; // link hover → --link-hover
  tierS: string;
  tierA: string;
  tierB: string;
  tierC: string;
  tierD: string;
  tierF: string;
  difficultyBeginner: string;
  difficultyIntermediate: string;
  difficultyAdvanced: string;
  badgePending: string;
  badgeApproved: string;
  badgeRejected: string;
  badgeDraft: string;
  badgeArchived: string;
};

/** Built-in defaults (hex) that mirror the current palette. */
export const THEME_DEFAULTS: ThemeSettings = {
  accent: "#ae2929",
  button: "#ae2929",
  link: "#ae2929",
  linkHover: "#ae2929",
  tierS: "#dc2626",
  tierA: "#f97316",
  tierB: "#f59e0b",
  tierC: "#16a34a",
  tierD: "#2563eb",
  tierF: "#52525b",
  difficultyBeginner: "#22c55e",
  difficultyIntermediate: "#f59e0b",
  difficultyAdvanced: "#ef4444",
  badgePending: "#eab308",
  badgeApproved: "#22c55e",
  badgeRejected: "#c52020",
  badgeDraft: "#a1a1aa",
  badgeArchived: "#71717a",
};

/** Theme field → CSS variable(s) it drives. */
const VAR_MAP: Record<keyof ThemeSettings, string[]> = {
  accent: ["--primary", "--ring"],
  button: ["--button"],
  link: ["--link"],
  linkHover: ["--link-hover"],
  tierS: ["--tier-s"],
  tierA: ["--tier-a"],
  tierB: ["--tier-b"],
  tierC: ["--tier-c"],
  tierD: ["--tier-d"],
  tierF: ["--tier-f"],
  difficultyBeginner: ["--difficulty-beginner"],
  difficultyIntermediate: ["--difficulty-intermediate"],
  difficultyAdvanced: ["--difficulty-advanced"],
  badgePending: ["--badge-pending"],
  badgeApproved: ["--badge-approved"],
  badgeRejected: ["--badge-rejected"],
  badgeDraft: ["--badge-draft"],
  badgeArchived: ["--badge-archived"],
};

const SETTINGS_TAG = "site-settings";
const THEME_PREFIX = "theme.";

export type SettingsResult = { ok: true } | { ok: false; error: string };

// ---------- validation + color conversion ----------

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

function expandHex(hex: string): string {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    return h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return h;
}

/** Convert "#rrggbb" (or "#rgb") to an "H S% L%" triple for hsl(var()). */
export function hexToHslTriple(hex: string): string {
  const h = expandHex(hex);
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  let hue = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / d + 2;
        break;
      default:
        hue = (r - g) / d + 4;
        break;
    }
    hue /= 6;
  }

  const H = Math.round(hue * 360);
  const S = Math.round(s * 100);
  const L = Math.round(l * 100);
  return `${H} ${S}% ${L}%`;
}

// ---------- cached reads ----------

const readRawSettings = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const rows = await db.selectFrom("site_settings").selectAll().execute();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  },
  ["site-settings"],
  { tags: [SETTINGS_TAG] },
);

export async function getRawSettings(): Promise<Record<string, string>> {
  return readRawSettings();
}

/** Merge stored values over the built-in defaults into a typed ThemeSettings. */
export async function getThemeSettings(): Promise<ThemeSettings> {
  const raw = await getRawSettings();
  const out = { ...THEME_DEFAULTS };
  for (const key of Object.keys(THEME_DEFAULTS) as (keyof ThemeSettings)[]) {
    const stored = raw[`${THEME_PREFIX}${key}`];
    if (stored && isHexColor(stored)) out[key] = stored;
  }
  return out;
}

/** Read a single arbitrary setting (e.g. a site text) with a fallback. */
export async function getSetting(
  key: string,
  fallback = "",
): Promise<string> {
  const raw = await getRawSettings();
  return raw[key] ?? fallback;
}

// ---------- CSS injection ----------

/** Build the `<style>` body that overrides the design tokens from settings. */
export function buildThemeCss(theme: ThemeSettings): string {
  const lines: string[] = [];
  for (const key of Object.keys(VAR_MAP) as (keyof ThemeSettings)[]) {
    const triple = hexToHslTriple(theme[key]);
    for (const cssVar of VAR_MAP[key]) lines.push(`${cssVar}: ${triple};`);
  }
  // Apply in both light and dark so v1 colors are mode-independent. The
  // `html:root` / `html.dark` selectors outrank globals.css (`:root`/`.dark`)
  // regardless of stylesheet injection order.
  return `html:root,html.dark{${lines.join("")}}`;
}

// ---------- staff-guarded writes ----------

async function requireStaff(): Promise<SettingsResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) {
    return { ok: false, error: "Not authorized." };
  }
  return { ok: true };
}

/** Upsert theme color values (hex). Invalid hex values are rejected. */
export async function setThemeSettings(
  partial: Partial<ThemeSettings>,
): Promise<SettingsResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const entries = Object.entries(partial).filter(
    ([, v]) => typeof v === "string",
  ) as [keyof ThemeSettings, string][];

  for (const [, value] of entries) {
    if (!isHexColor(value)) {
      return { ok: false, error: `Invalid color: ${value}` };
    }
  }
  if (entries.length === 0) return { ok: true };

  try {
    const now = new Date().toISOString();
    await db
      .insertInto("site_settings")
      .values(
        entries.map(([key, value]) => ({
          key: `${THEME_PREFIX}${key}`,
          value: value.trim(),
          updated_at: now,
        })),
      )
      .onConflict((oc) =>
        oc.column("key").doUpdateSet((eb) => ({
          value: eb.ref("excluded.value"),
          updated_at: now,
        })),
      )
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Save failed." };
  }

  revalidateTag(SETTINGS_TAG);
  return { ok: true };
}

// ---------- site texts ----------

export type SiteTexts = {
  siteName: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  footerText: string;
  announcement: string;
};

export const TEXT_DEFAULTS: SiteTexts = {
  siteName: "Fog Archives",
  tagline:
    "A community platform for Dead by Daylight builds, tier lists, guides, and patch impact — by survivors and killers alike.",
  heroTitle: "Builds, tier lists, and patch impact — from inside the fog.",
  heroSubtitle:
    "A community platform for Dead by Daylight builds, tier lists, guides, and patch impact — by survivors and killers alike.",
  footerText:
    "Fog Archives — a community project. Not affiliated with Behaviour Interactive.",
  announcement: "",
};

const TEXT_PREFIX = "text.";
const TEXT_MAX = 2000;

/** Merge stored texts over defaults. */
export async function getSiteTexts(): Promise<SiteTexts> {
  const raw = await getRawSettings();
  const out = { ...TEXT_DEFAULTS };
  for (const key of Object.keys(TEXT_DEFAULTS) as (keyof SiteTexts)[]) {
    const stored = raw[`${TEXT_PREFIX}${key}`];
    if (typeof stored === "string") out[key] = stored;
  }
  return out;
}

/** Upsert site texts (staff-guarded). Empty string clears a field to blank. */
// ---------- maintenance mode ----------

export type MaintenanceSettings = { enabled: boolean; message: string };

export const MAINTENANCE_DEFAULTS: MaintenanceSettings = {
  enabled: false,
  message:
    "Fog Archives is down for maintenance. We'll be back shortly — thanks for your patience.",
};

const MAINTENANCE_PREFIX = "maintenance.";

export async function getMaintenanceSettings(): Promise<MaintenanceSettings> {
  const raw = await getRawSettings();
  const enabled = raw[`${MAINTENANCE_PREFIX}enabled`];
  const message = raw[`${MAINTENANCE_PREFIX}message`];
  return {
    enabled: enabled === "true",
    message:
      typeof message === "string" && message.length > 0
        ? message
        : MAINTENANCE_DEFAULTS.message,
  };
}

export async function setMaintenanceSettings(
  partial: Partial<MaintenanceSettings>,
): Promise<SettingsResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const rows: { key: string; value: string; updated_at: string }[] = [];
  const now = new Date().toISOString();
  if (typeof partial.enabled === "boolean") {
    rows.push({
      key: `${MAINTENANCE_PREFIX}enabled`,
      value: partial.enabled ? "true" : "false",
      updated_at: now,
    });
  }
  if (typeof partial.message === "string") {
    if (partial.message.length > 2000) {
      return { ok: false, error: "Message is too long." };
    }
    rows.push({
      key: `${MAINTENANCE_PREFIX}message`,
      value: partial.message,
      updated_at: now,
    });
  }
  if (rows.length === 0) return { ok: true };

  try {
    await db
      .insertInto("site_settings")
      .values(rows)
      .onConflict((oc) =>
        oc.column("key").doUpdateSet((eb) => ({
          value: eb.ref("excluded.value"),
          updated_at: now,
        })),
      )
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Save failed." };
  }
  revalidateTag(SETTINGS_TAG);
  return { ok: true };
}

export async function setSiteTexts(
  partial: Partial<SiteTexts>,
): Promise<SettingsResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const entries = Object.entries(partial).filter(
    ([, v]) => typeof v === "string",
  ) as [keyof SiteTexts, string][];
  for (const [, value] of entries) {
    if (value.length > TEXT_MAX) {
      return { ok: false, error: "Text is too long." };
    }
  }
  if (entries.length === 0) return { ok: true };

  try {
    const now = new Date().toISOString();
    await db
      .insertInto("site_settings")
      .values(
        entries.map(([key, value]) => ({
          key: `${TEXT_PREFIX}${key}`,
          value,
          updated_at: now,
        })),
      )
      .onConflict((oc) =>
        oc.column("key").doUpdateSet((eb) => ({
          value: eb.ref("excluded.value"),
          updated_at: now,
        })),
      )
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Save failed." };
  }
  revalidateTag(SETTINGS_TAG);
  return { ok: true };
}

/** Upsert an arbitrary setting (e.g. a site text). */
export async function setSetting(
  key: string,
  value: string,
): Promise<SettingsResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  try {
    const now = new Date().toISOString();
    await db
      .insertInto("site_settings")
      .values({ key, value, updated_at: now })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet((eb) => ({
          value: eb.ref("excluded.value"),
          updated_at: now,
        })),
      )
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Save failed." };
  }
  revalidateTag(SETTINGS_TAG);
  return { ok: true };
}
