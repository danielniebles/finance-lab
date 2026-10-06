export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/ds";
import { CategoryList } from "@/components/settings/category-list";
import { AddCategoryButton } from "@/components/settings/categories/category-dialog";

export default async function CategoriesPage() {
  const categories = await db.appCategory.findMany({
    // The two transfer categories are system-owned (wallet transfers assign
    // them automatically); they never appear in pickers, so not here either.
    where: { isTransfer: false },
    orderBy: { name: "asc" },
    include: {
      budgetItems: { orderBy: { amount: "desc" } },
      _count: { select: { mappings: true } },
    },
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Categories"
        description="Each category's budget items set its monthly budget, the same every month."
        action={<AddCategoryButton />}
      />
      <CategoryList categories={categories} />
    </div>
  );
}
