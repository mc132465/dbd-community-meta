import type { Metadata } from "next";

import {
  getThemeSettings,
  THEME_DEFAULTS,
} from "@/lib/services/settings.service";
import { ThemeEditor } from "@/components/admin/theme-editor";

export const metadata: Metadata = { title: "Theme · Admin" };

export default async function ThemePage() {
  const current = await getThemeSettings();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Theme
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure site colors. Changes save to the database and apply on the
          next page load — no rebuild or redeploy. Colors are shared across light
          and dark mode.
        </p>
      </div>

      <ThemeEditor current={current} defaults={THEME_DEFAULTS} />
    </div>
  );
}
