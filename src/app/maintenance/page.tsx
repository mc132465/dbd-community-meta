import type { Metadata } from "next";

import { getMaintenanceSettings } from "@/lib/services/settings.service";
import { MaintenanceScreen } from "@/components/maintenance-gate";

export const metadata: Metadata = { title: "Maintenance" };

export default async function MaintenancePage() {
  const maintenance = await getMaintenanceSettings();
  return <MaintenanceScreen message={maintenance.message} />;
}
