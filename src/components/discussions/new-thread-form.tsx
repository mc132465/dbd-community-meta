"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createThreadAction } from "@/app/(main)/discussions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Category = { id: string; name: string };

const fieldClass =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NewThreadForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createThreadAction({
      title,
      category_id: categoryId,
      body,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Couldn't create the thread");
      return;
    }
    toast.success("Discussion started");
    router.push(`/discussions/${result.slug}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Is Pain Resonance still worth running?"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category *</Label>
        <select
          id="category"
          className={`${fieldClass} h-10`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Body *</Label>
        <textarea
          id="body"
          className={`${fieldClass} min-h-40`}
          value={body}
          maxLength={20000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your question or thoughts…"
        />
      </div>

      <Button type="submit" disabled={submitting || !title.trim() || !body.trim()}>
        {submitting ? "Posting…" : "Post discussion"}
      </Button>
    </form>
  );
}
