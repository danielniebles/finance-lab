export const dynamic = "force-dynamic";

import { getTagsForSettings } from "@/lib/queries/tags";
import { getCategories } from "@/lib/queries/expenses";
import { TagList } from "@/components/settings/tag-list";

export default async function TagsPage() {
  const [tags, categories] = await Promise.all([getTagsForSettings(), getCategories()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Tags</h1>
      <p className="text-sm text-muted-foreground">
        Soft, budget-free labels for filtering transactions — a tag&apos;s optional default
        category lets the assistant map a hashtag like &quot;#uber&quot; straight to the right
        category. Tags can also be created on the fly from the ledger, so this list is only
        for renaming, deleting, or setting a default category.
      </p>
      <TagList tags={tags} categories={categories} />
    </div>
  );
}
