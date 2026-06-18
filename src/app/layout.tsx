import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Oswald } from "next/font/google";

import { siteConfig } from "@/config/site";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/layout/navbar";
import { EmailNagBanner } from "@/components/layout/email-nag-banner";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "@/components/ui/sonner";
import { MaintenanceScreen } from "@/components/maintenance-gate";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import {
  buildThemeCss,
  getThemeSettings,
  getSiteTexts,
  getMaintenanceSettings,
} from "@/lib/services/settings.service";
import "./globals.css";

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const display = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// This app is DB-backed and per-request (auth cookies, live data), so nothing is
// statically prerendered. This also lets the production image build without a
// database — pages and generateMetadata run at request time, not at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getSiteTexts();
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: `${texts.siteName} — Dead by Daylight community`,
      template: `%s · ${texts.siteName}`,
    },
    description: texts.tagline,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [theme, texts, maintenance, profile] = await Promise.all([
    getThemeSettings(),
    getSiteTexts(),
    getMaintenanceSettings(),
    getCurrentProfile(),
  ]);
  const themeCss = buildThemeCss(theme);

  // Maintenance mode (option A): enforced here. Staff bypass; everyone else
  // sees the maintenance screen — except on allow-listed routes so logged-out
  // admins can still reach the login form.
  const pathname = headers().get("x-pathname") ?? "";
  const allowListed =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/maintenance";
  const maintenanceActive =
    maintenance.enabled && !isModerator(profile?.role) && !allowListed;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style
          id="theme-vars"
          dangerouslySetInnerHTML={{ __html: themeCss }}
        />
      </head>
      <body className={`${body.variable} ${display.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {maintenanceActive ? (
            <MaintenanceScreen message={maintenance.message} />
          ) : (
            <div className="flex min-h-dvh flex-col">
              {texts.announcement.trim() ? (
                <div className="bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
                  {texts.announcement}
                </div>
              ) : null}
              <Navbar />
              <EmailNagBanner />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          )}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
