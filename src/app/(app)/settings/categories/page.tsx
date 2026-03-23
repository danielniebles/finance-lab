export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { CategoryList } from "@/components/settings/category-list";

export default async function CategoriesPage() {
  const categories = await db.appCategory.findMany({
    orderBy: { name: "asc" },
    include: {
      budgetItems: { orderBy: { amount: "desc" } },
      _count: { select: { mappings: true } },
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Categories</h1>
      <p className="text-sm text-muted-foreground">
        Define your simplified budget categories. Each category has a monthly budget that applies to every month.
      </p>
      <CategoryList categories={categories} />
    </div>
  );
}
