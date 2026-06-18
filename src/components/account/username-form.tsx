"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { changeUsernameAction } from "@/app/account/actions";
import {
  changeUsernameSchema,
  type ChangeUsernameInput,
} from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  currentUsername: string;
  /** When the cooldown allows another change, or null if it's available now. */
  availableAt: string | null;
};

export function UsernameForm({ currentUsername, availableAt }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const onCooldown = availableAt ? new Date(availableAt) > new Date() : false;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangeUsernameInput>({
    resolver: zodResolver(changeUsernameSchema),
    defaultValues: { username: currentUsername },
  });

  async function onSubmit(values: ChangeUsernameInput) {
    setServerError(null);
    const result = await changeUsernameAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    toast.success("Username updated");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          autoCapitalize="none"
          spellCheck={false}
          disabled={onCooldown || isSubmitting}
          {...register("username")}
        />
        {errors.username ? (
          <p className="text-sm text-destructive">{errors.username.message}</p>
        ) : null}
        {onCooldown && availableAt ? (
          <p className="text-xs text-muted-foreground">
            You can change your username again on{" "}
            {new Date(availableAt).toLocaleDateString()}.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            You can change your username once every 30 days. Login is unaffected.
          </p>
        )}
      </div>

      {serverError ? (
        <p className="text-sm text-destructive">{serverError}</p>
      ) : null}

      <Button type="submit" disabled={onCooldown || isSubmitting}>
        {isSubmitting ? "Saving…" : "Save username"}
      </Button>
    </form>
  );
}
