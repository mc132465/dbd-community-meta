"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { signInAction } from "@/app/(auth)/actions";
import { signInSchema, type SignInInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: SignInInput) {
    setServerError(null);
    const result = await signInAction(values);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    toast.success("Welcome back");
    const next = searchParams.get("next") ?? "/";
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="identifier">Username or email</Label>
        <Input
          id="identifier"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          {...register("identifier")}
        />
        {errors.identifier ? (
          <p className="text-sm text-destructive">{errors.identifier.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <a
            href="/forgot"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Forgot password?
          </a>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      {serverError ? (
        <p className="text-sm text-destructive">{serverError}</p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Log in"}
      </Button>
    </form>
  );
}
