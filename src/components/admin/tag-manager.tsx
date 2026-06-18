"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createCategory,
  createTag,
  deleteTag,
  setTagActive,
  updateTag,
} from "@/app/admin/tags/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Category = { id: string; name: string };
type Tag = {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
  is_active: boolean;
  category_name: string | null;
};

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TagManager({
  categories,
  tags,
}: {
  categories: Category[];
  tags: Tag[];
}) {
  const router = useRouter();
  const [newCategory, setNewCategory] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newTagCategory, setNewTagCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [busy, setBusy] = useState(false);

  function refresh(message: string) {
    toast.success(message);
    router.refresh();
  }

  async function handle<T>(fn: () => Promise<T>, ok: string) {
    setBusy(true);
    const result = (await fn()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return false;
    }
    refresh(ok);
    return true;
  }

  return (
    <div className="space-y-8">
      {/* Create category */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          New category
        </h3>
        <div className="flex gap-2">
          <Input
            value={newCategory}
            placeholder="Category name"
            onChange={(e) => setNewCategory(e.target.value)}
            className="max-w-xs"
          />
          <Button
            disabled={busy || !newCategory.trim()}
            onClick={async () => {
              if (await handle(() => createCategory({ name: newCategory }), "Category added"))
                setNewCategory("");
            }}
          >
            Add category
          </Button>
        </div>
      </section>

      {/* Create tag */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          New tag
        </h3>
        <div className="flex flex-wrap gap-2">
          <Input
            value={newTag}
            placeholder="Tag name"
            onChange={(e) => setNewTag(e.target.value)}
            className="max-w-xs"
          />
          <select
            className={selectClass}
            value={newTagCategory}
            onChange={(e) => setNewTagCategory(e.target.value)}
          >
            <option value="">— no category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            disabled={busy || !newTag.trim()}
            onClick={async () => {
              if (
                await handle(
                  () =>
                    createTag({
                      name: newTag,
                      category_id: newTagCategory,
                      is_active: true,
                    }),
                  "Tag added",
                )
              ) {
                setNewTag("");
                setNewTagCategory("");
              }
            }}
          >
            Add tag
          </Button>
        </div>
      </section>

      {/* Tag table */}
      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Tags ({tags.length})
        </h3>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => {
                  const editing = editingId === tag.id;
                  return (
                    <tr key={tag.id} className="border-t border-border/60">
                      <td className="px-4 py-2">
                        {editing ? (
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-9"
                          />
                        ) : (
                          <>
                            {tag.name}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {tag.slug}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {editing ? (
                          <select
                            className={selectClass}
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                          >
                            <option value="">— none —</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          tag.category_name ?? "—"
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            tag.is_active
                              ? "text-green-500"
                              : "text-muted-foreground"
                          }
                        >
                          {tag.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {editing ? (
                            <>
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={async () => {
                                  if (
                                    await handle(
                                      () =>
                                        updateTag(tag.id, {
                                          name: editName,
                                          category_id: editCategory,
                                          is_active: tag.is_active,
                                        }),
                                      "Tag updated",
                                    )
                                  )
                                    setEditingId(null);
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingId(tag.id);
                                  setEditName(tag.name);
                                  setEditCategory(tag.category_id ?? "");
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  handle(
                                    () => setTagActive(tag.id, !tag.is_active),
                                    tag.is_active ? "Disabled" : "Enabled",
                                  )
                                }
                              >
                                {tag.is_active ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Delete "${tag.name}"? It will be removed from all builds.`,
                                    )
                                  )
                                    handle(() => deleteTag(tag.id), "Deleted");
                                }}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
