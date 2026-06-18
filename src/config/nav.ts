export type NavItem = {
  title: string;
  href: string;
  /** Disabled items are part of the planned IA but not built yet. */
  disabled?: boolean;
};

/**
 * Primary navigation — kept lean and focused on the core destinations. Items,
 * Add-ons, Maps, Meta, Activity, and Guides are intentionally not in the nav
 * (the pages still exist and are reachable by direct link / from related pages).
 */
export const mainNav: NavItem[] = [
  { title: "Characters", href: "/characters" },
  { title: "Perks", href: "/perks" },
  { title: "Builds", href: "/builds" },
  { title: "Tier Lists", href: "/tier-lists" },
  { title: "Discussions", href: "/discussions" },
];
