"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AssetType, Field } from "@/lib/admin/asset-config";
import { createAsset, updateAsset } from "@/app/admin/assets/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type RefOptions = Record<string, { value: string; label: string }[]>;

type Props = {
  type: AssetType;
  fields: Field[];
  refOptions: RefOptions;
  initialValues?: Record<string, unknown>;
  id?: string;
};

export function AssetForm({
  type,
  fields,
  refOptions,
  initialValues,
  id,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(
    () => initialValues ?? {},
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const missing = fields.find(
      (f) => f.required && !String(values[f.name] ?? "").trim(),
    );
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }

    setSubmitting(true);
    const result = id
      ? await updateAsset(type, id, values)
      : await createAsset(type, values);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success(id ? "Saved" : "Created");
    router.push(`/admin/assets/${type}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      {fields.map((field) => (
        <div key={field.name} className="space-y-2">
          {field.type !== "checkbox" ? (
            <Label htmlFor={field.name}>
              {field.label}
              {field.required ? " *" : ""}
            </Label>
          ) : null}

          {field.type === "text" || field.type === "date" ? (
            <Input
              id={field.name}
              type={field.type === "date" ? "date" : "text"}
              value={String(values[field.name] ?? "")}
              onChange={(e) => set(field.name, e.target.value)}
            />
          ) : null}

          {field.type === "textarea" ? (
            <textarea
              id={field.name}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={String(values[field.name] ?? "")}
              onChange={(e) => set(field.name, e.target.value)}
            />
          ) : null}

          {field.type === "enum" ? (
            <select
              id={field.name}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={String(values[field.name] ?? "")}
              onChange={(e) => set(field.name, e.target.value)}
            >
              <option value="">— select —</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : null}

          {field.type === "ref" ? (
            <select
              id={field.name}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={String(values[field.name] ?? "")}
              onChange={(e) => set(field.name, e.target.value)}
            >
              <option value="">— none —</option>
              {(refOptions[field.refType ?? ""] ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : null}

          {field.type === "checkbox" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(values[field.name])}
                onChange={(e) => set(field.name, e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              {field.label}
            </label>
          ) : null}
        </div>
      ))}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : id ? "Save changes" : "Create"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/admin/assets/${type}`)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
