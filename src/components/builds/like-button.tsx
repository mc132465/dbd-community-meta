"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleLikeAction } from "@/app/(main)/builds/[slug]/actions";

type Props = {
  buildId: string;
  initialLiked: boolean;
  initialCount: number;
  isLoggedIn: boolean;
  loginHref: string;
};

export function LikeButton({
  buildId,
  initialLiked,
  initialCount,
  isLoggedIn,
  loginHref,
}: Props) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!isLoggedIn) {
      toast.message("Log in to like this build.");
      router.push(loginHref);
      return;
    }
    startTransition(async () => {
      const res = await toggleLikeAction(buildId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLiked(res.liked);
      setCount(res.count);
    });
  }

  return (
    <Button
      type="button"
      variant={liked ? "secondary" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-pressed={liked}
    >
      {pending ? "Working…" : liked ? "Liked" : "Like"}
      <span className="ml-1 tabular-nums text-muted-foreground">{count}</span>
    </Button>
  );
}
