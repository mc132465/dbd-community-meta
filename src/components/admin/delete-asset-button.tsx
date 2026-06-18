"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AssetType } from "@/lib/admin/asset-config";
import { deleteAsset } from "@/app/admin/assets/actions";
import { Button } from "@/components/ui/button";

export function DeleteAssetButton({
  type,
  id,
  name,
}: {
  type: AssetType;
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    const result = await deleteAsset(type, id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Deleted");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={busy}
      className="text-destructive hover:text-destructive"
    >
      Delete
    </Button>
  );
}
