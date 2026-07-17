export const dynamic = "force-dynamic";

import { getCounterpartyRules } from "@/lib/queries/counterparty-rules";
import { getCategories } from "@/lib/queries/expenses";
import { listWalletOptions } from "@/lib/queries/wallets";
import { RuleList } from "@/components/settings/rule-list";

export default async function RulesPage() {
  const [rules, categories, walletOptions] = await Promise.all([
    getCounterpartyRules(),
    getCategories(),
    listWalletOptions(),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Counterparty Rules</h1>
      <p className="text-sm text-muted-foreground">
        Map known accounts, merchants, and senders to a category and wallet so matching bank
        messages are auto-recorded instead of requiring manual review.
      </p>
      <RuleList rules={rules} categories={categories} walletOptions={walletOptions} />
    </div>
  );
}
