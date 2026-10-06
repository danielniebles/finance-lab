export const dynamic = "force-dynamic";

import { getTagsForSettings } from "@/lib/queries/tags";
import { getCategories } from "@/lib/queries/expenses";
import { PageHeader } from "@/components/ds";
import { AddTagButton, TagList } from "@/components/settings/tag-list";

export default async function TagsPage() {
  const [tags, categories] = await Promise.all([getTagsForSettings(), getCategories()]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Tags"
        description="Labels for filtering transactions, with no budget. A default category lets the Advisor file a #tag straight into it."
        action={<AddTagButton categories={categories} />}
      />
      <TagList tags={tags} categories={categories} />
    </div>
  );
}
