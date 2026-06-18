export const siteConfig = {
  name: "Fog Archives",
  shortName: "Fog Archives",
  description:
    "A community platform for Dead by Daylight builds, tier lists, guides, and patch impact — by survivors and killers alike.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export type SiteConfig = typeof siteConfig;
