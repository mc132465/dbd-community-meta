"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { MaintenanceSettings } from "@/lib/services/settings.service";
import { saveMaintenanceAction } from "@/app/admin/maintenance/actions";
import { Button } from "@/components/ui/button";

const fieldClass =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MaintenanceControls({
  current,
}: {
  current: MaintenanceSettings;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(current.enabled);
  const [message, setMessage] = useState(current.message);
  const [busy, setBusy] = useState(false);

  async function save(next: Partial<MaintenanceSettings>, label: string) {
    setBusy(true);
    const r = await saveMaintenanceAction(next);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error ?? "Save failed");
      return;
    }
    toast.success(label);
    router.refresh();
  }

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    await save({ enabled: next, message }, next ? "Maintenance ON" : "Maintenance OFF");
  }

  return (
    <div className="space-y-5">
      <div
        className={`flex items-center justify-between gap-4 rounded-lg border p-4 ${
          enabled ? "border-primary/40 bg-primary/5" : "border-border/60"
        }`}
      >
        <div>
          <p className="font-medium">
            Maintenance mode is {enabled ? "ON" : "OFF"}
          </p>
          <p className="text-sm text-muted-foreground">
            {enabled
              ? "Visitors see the maintenance page. Moderators and admins still have full access."
              : "The site is live for everyone."}
          </p>
        </div>
        <Button
          variant={enabled ? "outline" : "default"}
          disabled={busy}
          onClick={toggle}
        >
          {enabled ? "Turn OFF" : "Turn ON"}
        </Button>
      </div>

      <div className="space-y-2">
        <label htmlFor="maint-msg" className="text-sm font-medium">
          Maintenance message
        </label>
        <textarea
          id="maint-msg"
          className={`${fieldClass} min-h-28`}
          value={message}
          maxLength={2000}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => save({ message }, "Message saved")}
        >
          Save message
        </Button>
      </div>
    </div>
  );
}
