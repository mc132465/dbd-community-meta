import type { Metadata } from "next";

import { getMaintenanceSettings } from "@/lib/services/settings.service";
import { MaintenanceControls } from "@/components/admin/maintenance-controls";

export const metadata: Metadata = { title: "Maintenance · Admin" };

export default async function AdminMaintenancePage() {
  const current = await getMaintenanceSettings();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Maintenance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Take the public site offline for visitors while you work. Moderators
          and admins keep full access. Changes apply on the next page load — no
          rebuild.
        </p>
      </div>

      <MaintenanceControls current={current} />
    </div>
  );
}
