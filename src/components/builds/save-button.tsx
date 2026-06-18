"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleFavoriteAction } from "@/app/(main)/builds/[slug]/actions";

type Props = {
  buildId: string;
  initialSaved: boolean;
  isLoggedIn: boolean;
  loginHref: string;
};

export function SaveButton({
  buildId,
  initialSaved,
  isLoggedIn,
  loginHref,
}: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!isLoggedIn) {
      toast.message("Log in to save builds.");
      router.push(loginHref);
      return;
    }
    startTransition(async () => {
      const res = await toggleFavoriteAction(buildId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(res.saved);
      toast.success(res.saved ? "Saved to your builds." : "Removed from saved.");
    });
  }

  return (
    <Button
      type="button"
      variant={saved ? "secondary" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
    >
      {pending ? "Working…" : saved ? "Saved" : "Save"}
    </Button>
  );
}
