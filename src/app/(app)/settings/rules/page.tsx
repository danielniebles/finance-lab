export const dynamic = "force-dynamic";

import { getCounterpartyRules } from "@/lib/queries/counterparty-rules";
import { getCategories } from "@/lib/queries/expenses";
import { listWalletOptions } from "@/lib/queries/wallets";
import { PageHeader } from "@/components/ds";
import { AddRuleButton, RuleList } from "@/components/settings/rule-list";

export default async function RulesPage() {
  const [rules, categories, walletOptions] = await Promise.all([
    getCounterpartyRules(),
    getCategories(),
    listWalletOptions(),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Counterparty rules"
        description="Known accounts, merchants and senders, routed to a category and wallet so their bank messages skip review."
        action={<AddRuleButton categories={categories} walletOptions={walletOptions} />}
      />
      <RuleList rules={rules} categories={categories} walletOptions={walletOptions} />
    </div>
  );
}
