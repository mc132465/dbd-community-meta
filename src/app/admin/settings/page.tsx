import type { Metadata } from "next";

import { getSiteTexts, TEXT_DEFAULTS } from "@/lib/services/settings.service";
import { SiteTextsEditor } from "@/components/admin/site-texts-editor";

export const metadata: Metadata = { title: "Content · Admin" };

export default async function SiteSettingsPage() {
  const current = await getSiteTexts();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Site content
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit site name, hero text, footer, and the optional announcement
          banner. Changes save to the database and apply on the next page load —
          no rebuild.
        </p>
      </div>

      <SiteTextsEditor current={current} defaults={TEXT_DEFAULTS} />
    </div>
  );
}
