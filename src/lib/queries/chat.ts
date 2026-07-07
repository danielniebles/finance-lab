import { getMonthlyAnalysis, getAvailableMonths, type AvailableMonth } from "./expenses";
import { getLoansOverview } from "./loans";
import { getAllInstallments } from "./installments";
import type { LoansOverview } from "./loans";
import type { InstallmentRow } from "./installments";

type MonthlyAnalysis = Awaited<ReturnType<typeof getMonthlyAnalysis>>;

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function cop(n: number): string {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(n))} COP`;
}

function pct(n: number | null, decimals = 1): string {
  return n !== null ? `${n.toFixed(decimals)}%` : "N/A";
}

// ─── Expenses section ───────────────────────────────────────────────────────

function buildLatestMonthLines(
  latest: AvailableMonth,
  latestAnalysis: MonthlyAnalysis,
  isCurrentMonth: boolean,
): string[] {
  const lines: string[] = [];
  const label = `${MONTH_NAMES[latest.month - 1]} ${latest.year}`;

  lines.push(`## Expenses — ${label}${isCurrentMonth ? " (current month)" : " (most recent import)"}`);
  lines.push(`- Income: ${cop(latestAnalysis.totalIncome)}`);
  lines.push(`- Total expenses: ${cop(latestAnalysis.totalExpenses)}`);
  lines.push(`- Savings rate: ${pct(latestAnalysis.savingsRate)} (target ≥ 20%)`);
  lines.push(`- Real savings: ${cop(latestAnalysis.realSavings)}`);
  lines.push(`- Ideal savings: ${cop(latestAnalysis.idealSavings)}`);
  lines.push(`- Savings gap vs budget: ${cop(latestAnalysis.savingsGap)}`);
  lines.push(`- Variable burn rate: ${pct(latestAnalysis.variableBurnRate)} (alert if > 100%)`);
  if (latestAnalysis.unplannedSpendTotal > 0) {
    lines.push(`- Unplanned spending: ${cop(latestAnalysis.unplannedSpendTotal)}`);
  }
  lines.push(``);

  lines.push(`### Budget overview`);
  lines.push(`- Fixed budget: ${cop(latestAnalysis.fixedBudget)}`);
  lines.push(`- Variable budget: ${cop(latestAnalysis.variableBudget)}`);
  lines.push(`- Total budget: ${cop(latestAnalysis.totalBudget)}`);
  lines.push(`- Fixed actual: ${cop(latestAnalysis.fixedActual)}`);
  lines.push(`- Variable actual: ${cop(latestAnalysis.variableActual)}`);
  lines.push(``);

  lines.push(`### Category breakdown`);
  for (const cat of latestAnalysis.categoryBreakdown) {
    const ctrl = cat.control < 0
      ? ` (over by ${cop(Math.abs(cat.control))})`
      : cat.control > 0 ? ` (${cop(cat.control)} remaining)` : "";
    lines.push(`- ${cat.name} [${cat.budgetType}]: spent ${cop(cat.spent)} / budget ${cop(cat.budget)} — ${cat.severity}${ctrl}`);
  }

  const problems = latestAnalysis.categoryBreakdown.filter(
    (c) => c.severity === "Critical" || c.severity === "Unplanned"
  );
  if (problems.length > 0) {
    lines.push(``);
    lines.push(`### ⚠ Problem categories`);
    for (const c of problems) {
      lines.push(`- ${c.name}: ${c.severity} — spent ${cop(c.spent)} vs budget ${cop(c.budget)}`);
    }
  }

  return lines;
}

function buildTrendSummaryTable(months: AvailableMonth[], analyses: MonthlyAnalysis[]): string[] {
  const lines: string[] = [];
  lines.push(`| Month | Income | Expenses | Savings rate | Var. burn |`);
  lines.push(`|-------|--------|----------|--------------|-----------|`);
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const a = analyses[i];
    const label = `${MONTH_NAMES[m.month - 1]} ${m.year}`;
    lines.push(`| ${label} | ${cop(a.totalIncome)} | ${cop(a.totalExpenses)} | ${pct(a.savingsRate)} | ${pct(a.variableBurnRate)} |`);
  }
  return lines;
}

function buildSavingsRateTrendLine(latestAnalysis: MonthlyAnalysis, prevAnalysis: MonthlyAnalysis): string {
  const rateNow = latestAnalysis.savingsRate ?? 0;
  const ratePrev = prevAnalysis.savingsRate ?? 0;
  const diff = rateNow - ratePrev;
  const direction = diff > 1
    ? `▲ improving (+${diff.toFixed(1)}pp)`
    : diff < -1 ? `▼ declining (${diff.toFixed(1)}pp)` : `→ stable`;
  return `Savings rate trend: ${direction}`;
}

function buildVariableCategoryTrendLines(latestAnalysis: MonthlyAnalysis, analyses: MonthlyAnalysis[]): string[] {
  const variableCats = latestAnalysis.categoryBreakdown.filter(
    (c) => c.budgetType !== "FIXED" && c.budget > 0
  );
  if (variableCats.length === 0) return [];

  const lines: string[] = [``, `### Variable category trends (newest → oldest)`];
  for (const cat of variableCats) {
    const spends = analyses.map((a) => a.categoryBreakdown.find((c) => c.name === cat.name)?.spent ?? 0);
    const trend = spends.length >= 2
      ? spends[0] > spends[1] * 1.1 ? " ↑" : spends[0] < spends[1] * 0.9 ? " ↓" : " →"
      : "";
    lines.push(`- ${cat.name}: ${spends.map((s) => cop(s)).join(" → ")}${trend}`);
  }
  return lines;
}

function buildTrendLines(months: AvailableMonth[], analyses: MonthlyAnalysis[]): string[] {
  if (months.length <= 1) return [];

  const lines: string[] = [``, `## Spending trends (last ${months.length} months, newest first)`];
  lines.push(...buildTrendSummaryTable(months, analyses));
  lines.push(``, buildSavingsRateTrendLine(analyses[0], analyses[1]));
  lines.push(...buildVariableCategoryTrendLines(analyses[0], analyses));
  return lines;
}

async function buildExpensesSection(now: Date): Promise<string[]> {
  // Fetch the 3 most recent financial months with any data (manual or imported)
  // for trend analysis — a manual-only month has no ImportBatch row, so the
  // available-months union (not a raw ImportBatch query) is the source here.
  const available = await getAvailableMonths();
  const months = available.slice(-3).reverse();

  if (months.length === 0) {
    return [`## Expenses`, `No expense data imported yet.`];
  }

  const analyses = await Promise.all(months.map((m) => getMonthlyAnalysis(m.month, m.year)));
  const isCurrentMonth = months[0].month === now.getMonth() + 1 && months[0].year === now.getFullYear();

  return [
    ...buildLatestMonthLines(months[0], analyses[0], isCurrentMonth),
    ...buildTrendLines(months, analyses),
  ];
}

// ─── Savings accounts / loans / installments sections ──────────────────────

function buildSavingsAccountsSection(loans: LoansOverview): string[] {
  const lines: string[] = [`## Savings accounts`];
  lines.push(`- Liquid available (included accounts): ${cop(loans.available)}`);
  lines.push(`- Total in active loans: ${cop(loans.inLoans)}`);
  lines.push(`- Total savings (liquid + loans): ${cop(loans.totalSavings)}`);
  lines.push(`- Liquidity ratio: ${pct(loans.liquidityRatio)} (liquid / total)`);
  lines.push(``);
  for (const acc of loans.accounts) {
    const excluded = !acc.includeInAvailable ? " [excluded from available]" : "";
    const inLoans = acc.loansOut > 0 ? `, ${cop(acc.loansOut)} out in loans` : "";
    lines.push(`- ${acc.name} (${acc.accountType}): balance ${cop(acc.balance)}${inLoans}${excluded}`);
  }
  lines.push(``);
  return lines;
}

function buildActiveDebtorLines(debtor: LoansOverview["debtors"][number], now: Date): string[] {
  const lines: string[] = [
    `### ${debtor.name} — owes ${cop(debtor.totalOwed)} (${debtor.activeLoansCount} active loan${debtor.activeLoansCount !== 1 ? "s" : ""})`,
  ];
  for (const loan of debtor.loans.filter((l) => l.isActive)) {
    const age = Math.floor((Date.now() - new Date(loan.date).getTime()) / (1000 * 60 * 60 * 24));
    const ageLabel = age >= 30 ? `${Math.floor(age / 30)} months` : `${age} days`;
    const overdue = loan.expectedBy && new Date(loan.expectedBy) < now ? " ⚠ OVERDUE" : "";
    const expected = loan.expectedBy
      ? `, expected by ${new Date(loan.expectedBy).toLocaleDateString("es-CO", { month: "short", year: "numeric" })}`
      : "";
    lines.push(`  - ${cop(loan.remaining)} remaining (original ${cop(loan.amount)}, ${pct(loan.amount > 0 ? (loan.paid / loan.amount) * 100 : null, 0)} repaid) via ${loan.accountName}, ${ageLabel} old${expected}${overdue}`);
    if (loan.notes) lines.push(`    Notes: ${loan.notes}`);
  }
  return lines;
}

function buildLoansSection(loans: LoansOverview, now: Date): string[] {
  const lines: string[] = [`## Loans`];
  const activeDebtors = loans.debtors.filter((d) => d.totalOwed > 0);

  if (activeDebtors.length === 0) {
    lines.push(`No active loans.`);
  } else {
    for (const debtor of activeDebtors) {
      lines.push(...buildActiveDebtorLines(debtor, now));
    }
  }

  const settledDebtors = loans.debtors.filter((d) => d.totalOwed === 0 && d.loans.length > 0);
  if (settledDebtors.length > 0) {
    lines.push(``, `Fully settled debtors: ${settledDebtors.map((d) => d.name).join(", ")}`);
  }
  lines.push(``);
  return lines;
}

function buildInstallmentsSection(installments: InstallmentRow[]): string[] {
  const lines: string[] = [`## Installments`];
  const activeInstallments = installments.filter((i) => i.status === "Active");

  if (activeInstallments.length === 0) {
    lines.push(`No active installments.`);
  } else {
    const monthlyTotal = activeInstallments.reduce((s, i) => s + i.monthlyAmount, 0);
    lines.push(`Monthly installment obligation: ${cop(monthlyTotal)} across ${activeInstallments.length} active installment${activeInstallments.length !== 1 ? "s" : ""}`);
    lines.push(``);
    for (const inst of activeInstallments) {
      const remaining = inst.numInstallments - inst.installmentsPaid;
      lines.push(`- ${inst.description}: ${cop(inst.monthlyAmount)}/mo, ${inst.installmentsPaid}/${inst.numInstallments} paid, ${remaining} remaining, ${cop(inst.remaining)} left`);
      if (inst.notes) lines.push(`  Notes: ${inst.notes}`);
    }
  }

  const finishedCount = installments.filter((i) => i.status === "Finished").length;
  if (finishedCount > 0) {
    lines.push(`Finished installments: ${finishedCount}`);
  }
  return lines;
}

/**
 * Assembles a plain-text financial snapshot of the user's current situation.
 * This is injected into the Claude system prompt on every request.
 * No tokens are spent here — this runs purely against the local DB.
 */
export async function getFinancialSnapshot(): Promise<string> {
  const now = new Date();

  const [expensesLines, loans, installments] = await Promise.all([
    buildExpensesSection(now),
    getLoansOverview(),
    getAllInstallments(),
  ]);

  const lines: string[] = [
    `# Financial Snapshot`,
    `Date: ${now.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
    `Currency: Colombian Peso (COP). All amounts in COP.`,
    ``,
    ...expensesLines,
    ``,
    ...buildSavingsAccountsSection(loans),
    ...buildLoansSection(loans, now),
    ...buildInstallmentsSection(installments),
  ];

  return lines.join("\n");
}
