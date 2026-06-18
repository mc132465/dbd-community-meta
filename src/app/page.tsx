import Link from "next/link";

import { getCurrentProfile } from "@/lib/services/profile.service";
import { getSiteTexts } from "@/lib/services/settings.service";
import { Button } from "@/components/ui/button";

const PLANNED: { title: string; note: string; href?: string }[] = [
  {
    title: "Builds",
    note: "Share loadouts with beginner-friendly notes.",
    href: "/builds",
  },
  {
    title: "Tier Lists",
    note: "Official lists plus the Community Meta.",
    href: "/tier-lists",
  },
  {
    title: "Characters",
    note: "Killers, survivors, perks, add-ons, maps.",
    href: "/characters",
  },
  { title: "Patch Impact", note: "See what each update changes." },
];

export default async function HomePage() {
  const [profile, texts] = await Promise.all([
    getCurrentProfile(),
    getSiteTexts(),
  ]);

  return (
    <div className="container">
      <section className="flex flex-col items-start gap-6 py-20 md:py-28">
        <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
          Community platform · Phase 0
        </span>
        <h1 className="max-w-3xl font-display text-4xl font-bold uppercase leading-[1.05] tracking-tight sm:text-6xl">
          {texts.heroTitle}
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          {texts.heroSubtitle}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {profile ? (
            <Button asChild size="lg">
              <Link href="/account">Go to your account</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link href="/signup">Create an account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="border-t border-border/60 py-12">
        <h2 className="mb-6 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Coming as the build progresses
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANNED.map((item) => {
            const cardClass =
              "rounded-lg border border-border/60 bg-card p-5";
            const inner = (
              <>
                <h3 className="font-display text-lg font-semibold uppercase tracking-wide">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.note}
                </p>
              </>
            );
            return item.href ? (
              <Link
                key={item.title}
                href={item.href}
                className={`${cardClass} block cursor-pointer transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
              >
                {inner}
              </Link>
            ) : (
              <div key={item.title} className={cardClass}>
                {inner}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
