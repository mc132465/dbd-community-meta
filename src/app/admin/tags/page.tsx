import { listAllTags, listTagCategories } from "@/lib/services/tags.service";
import { TagManager } from "@/components/admin/tag-manager";

export default async function AdminTagsPage() {
  const [tags, categories] = await Promise.all([
    listAllTags(),
    listTagCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Tags
        </h2>
        <p className="text-sm text-muted-foreground">
          Create, edit, disable, and categorize build tags. Active tags appear in
          submission forms and the build filter automatically.
        </p>
      </div>

      <TagManager
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        tags={tags.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          category_id: t.category_id,
          is_active: t.is_active,
          category_name: t.category?.name ?? null,
        }))}
      />
    </div>
  );
}
