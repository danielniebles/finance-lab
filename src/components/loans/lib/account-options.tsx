import { ColorDot } from "@/components/ds";
import type { SelectOption } from "@/components/ds";
import { formatCOP } from "@/lib/format";
import type { AccountWithBalance } from "@/lib/queries/loans";

/** Savings accounts as OptionSelect options, with their colour dot (and balance, when asked). */
export function accountOptions(accounts: AccountWithBalance[], { withBalance = false } = {}): SelectOption[] {
  return accounts.map((a) => ({
    value: a.id,
    label: withBalance ? `${a.name} — ${formatCOP(a.balance)}` : a.name,
    leading: <ColorDot color={a.color} />,
  }));
}
