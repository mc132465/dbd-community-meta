import Link from "next/link";

import { getSiteTexts } from "@/lib/services/settings.service";
import { mainNav } from "@/config/nav";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { SearchBar } from "@/components/search/search-bar";

export async function Navbar() {
  const texts = await getSiteTexts();
  const profile = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-4">
        <div className="flex items-center gap-2">
          <MobileNav />
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-lg font-semibold uppercase tracking-[0.18em]">
              {texts.siteName}
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {mainNav.map((item) =>
            item.disabled ? (
              <span
                key={item.title}
                className="cursor-default px-3 py-2 text-sm text-muted-foreground/60"
                title="Coming soon"
              >
                {item.title}
              </span>
            ) : (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors hover:text-foreground"
              >
                {item.title}
              </Link>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchBar className="hidden w-40 sm:block lg:w-56" />
          {profile ? (
            <UserMenu
              username={profile.username}
              displayName={profile.display_name}
              avatarUrl={profile.avatar_url}
              role={profile.role}
            />
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
