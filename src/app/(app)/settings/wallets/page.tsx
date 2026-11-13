export const dynamic = "force-dynamic";

import { getWalletSettings } from "@/lib/queries/wallets";
import { PageHeader } from "@/components/ds";
import { WalletList } from "@/components/settings/wallets/wallet-list";

export default async function WalletsPage() {
  const accounts = await getWalletSettings();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Wallets"
        description="How each account's money is split, and which parts count toward your balances."
      />
      <WalletList accounts={accounts} />
    </div>
  );
}
