"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { reviewBuildAction } from "@/app/admin/builds/actions";
import { Button } from "@/components/ui/button";

export function ReviewActions({ buildId }: { buildId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(action: "approve" | "reject" | "archive") {
    let note = "";
    if (action === "reject") {
      note = window.prompt("Reason for rejection (optional):") ?? "";
    }
    setBusy(true);
    const result = await reviewBuildAction(buildId, { action, note });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Build ${action}d`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => run("approve")} disabled={busy}>
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => run("reject")}
        disabled={busy}
      >
        Reject
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => run("archive")}
        disabled={busy}
      >
        Archive
      </Button>
    </div>
  );
}
