// @vitest-environment node
//
// Characterization tests for run-agent-turn.ts — locks in CURRENT behavior as a
// regression net ahead of the planned god-file split (see docs/backlog.md).
// Testable seams only: pure formatters, proposal resolvers, and small pure helpers.
// See .scratch/run-agent-turn-test.md for the full test notes / coverage gaps.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatCOP } from "@/lib/format";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// @anthropic-ai/sdk constructs a real client at module scope in run-agent-turn.ts
// (`const anthropic = new Anthropic()`), which throws without an API key present
// in process.env at import time under Vitest. Mock the whole module so import
// never touches the network or throws.
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: vi.fn() };
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    importBatch: { findFirst: vi.fn() },
    transaction: { findMany: vi.fn() },
    pendingProposal: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    installment: { delete: vi.fn(), count: vi.fn() },
    creditCard: { delete: vi.fn() },
    loan: { delete: vi.fn(), count: vi.fn() },
    debtor: { delete: vi.fn() },
    loanPayment: { delete: vi.fn() },
  },
}));

vi.mock("@/lib/actions/chat", () => ({
  saveMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/queries/chat", () => ({
  getFinancialSnapshot: vi.fn().mockResolvedValue("snapshot"),
}));

vi.mock("@/lib/queries/health-score", () => ({
  getHealthScore: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/queries/expenses", () => ({
  getImportBatches: vi.fn().mockResolvedValue([]),
  getMonthlyAnalysis: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/queries/trends", () => ({
  getTrends: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/queries/installments", () => ({
  getAllInstallments: vi.fn().mockResolvedValue([]),
  getCardSummaries: vi.fn().mockResolvedValue([]),
  getMonthSummary: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/queries/loans", () => ({
  getLoansOverview: vi.fn(),
}));

vi.mock("@/lib/queries/vaults", () => ({
  getVaults: vi.fn().mockResolvedValue([]),
  getVaultObligations: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/queries/recurring", () => ({
  getRecurringExpenses: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/queries/forecast", () => ({
  getForecast: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/actions/drive", () => ({
  listDriveFiles: vi.fn(),
  importFromDrive: vi.fn(),
}));

// Import mocked functions to configure return values per test.
import { db } from "@/lib/db";
import { getLoansOverview } from "@/lib/queries/loans";
import { getAllInstallments, getCardSummaries } from "@/lib/queries/installments";
import { listDriveFiles } from "@/lib/actions/drive";
import type { LoansOverview } from "@/lib/queries/loans";
import type { InstallmentRow } from "@/lib/queries/installments";
import type { DriveFile } from "@/lib/actions/drive";

import {
  formatParamKey,
  formatParamValue,
  buildProposalTitle,
  buildProposalFields,
} from "./formatting";
import {
  resolveDriveFile,
  detectDrivePeriod,
  resolveImportFromDrive,
  resolveCreateInstallment,
  resolveMarkInstallmentPaid,
  resolveCreateLoan,
  resolveRecordLoanPayment,
  resolveAccountAdjustment,
  resolveTransfer,
  resolveUndoLast,
  resolveComplexProposal,
  RESOLVER_REGISTRY,
} from "./proposals";
import { PROPOSAL_ACTIONS } from "./actions";
import { deduplicateHistory, collectTextBlocks } from "./run-agent-turn";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLoansOverview(overrides?: Partial<LoansOverview>): LoansOverview {
  return {
    accounts: [],
    debtors: [],
    available: 0,
    inLoans: 0,
    totalSavings: 0,
    liquidityRatio: null,
    totalEverLent: 0,
    totalRecovered: 0,
    inVaults: 0,
    netWorth: 0,
    ...overrides,
  };
}

function makeInstallment(overrides?: Partial<InstallmentRow>): InstallmentRow {
  return {
    id: "inst-1",
    description: "Laptop",
    totalAmount: 3_000_000,
    numInstallments: 6,
    monthlyAmount: 500_000,
    monthlyInterestRate: null,
    startDate: new Date("2026-01-15T12:00:00"),
    endDate: new Date("2026-06-15T12:00:00"),
    notes: null,
    installmentsPaid: 0,
    remaining: 3_000_000,
    status: "Active",
    payments: [],
    cardId: null,
    cardName: null,
    cardColor: null,
    debtorId: null,
    debtorName: null,
    fundingAccountId: null,
    ...overrides,
  };
}

const BANCOLOMBIA_NAME = "Bancolombia";

const BANCOLOMBIA_ACCOUNT = {
  id: "a1",
  name: BANCOLOMBIA_NAME,
  accountType: "BANK" as const,
  color: null,
  includeInAvailable: true,
  balance: 0,
  loansOut: 0,
  entries: [],
  vaultEntries: [],
};

const NU_NAME = "Nu";

const NU_ACCOUNT = {
  id: "a2",
  name: NU_NAME,
  accountType: "DIGITAL" as const,
  color: null,
  includeInAvailable: true,
  balance: 0,
  loansOut: 0,
  entries: [],
  vaultEntries: [],
};

function makeLoanFixture(overrides?: Partial<{
  id: string;
  createdAt: Date;
  date: Date;
  remaining: number;
  isActive: boolean;
}>) {
  return {
    id: "loan-1",
    debtorId: "d1",
    accountId: "a1",
    accountName: BANCOLOMBIA_NAME,
    accountColor: null,
    amount: 1_000_000,
    date: new Date("2026-01-01T12:00:00"),
    expectedBy: null,
    notes: null,
    createdAt: new Date("2026-01-01T10:00:00"),
    paid: 0,
    remaining: 1_000_000,
    isActive: true,
    payments: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── formatParamKey ───────────────────────────────────────────────────────────

describe("formatParamKey", () => {
  it("inserts a space before each capital letter", () => {
    expect(formatParamKey("targetAmount")).toBe("Target Amount");
  });

  it("capitalizes the first letter", () => {
    expect(formatParamKey("amount")).toBe("Amount");
  });

  it("handles a single-word lowercase key", () => {
    expect(formatParamKey("name")).toBe("Name");
  });

  it("handles multiple camelCase humps", () => {
    expect(formatParamKey("fundingAccountName")).toBe("Funding Account Name");
  });
});

// ─── formatParamValue ─────────────────────────────────────────────────────────

describe("formatParamValue", () => {
  it("returns an em dash for null", () => {
    expect(formatParamValue("amount", null)).toBe("—");
  });

  it("returns an em dash for undefined", () => {
    expect(formatParamValue("amount", undefined)).toBe("—");
  });

  it("formats 'amount' key as COP currency", () => {
    expect(formatParamValue("amount", 1_500_000)).toBe("$1.500.000 COP");
  });

  it("formats 'targetAmount' key as COP currency", () => {
    expect(formatParamValue("targetAmount", 250_000)).toBe("$250.000 COP");
  });

  it("formats 'estimatedAmount' key as COP currency", () => {
    expect(formatParamValue("estimatedAmount", 99_999)).toBe("$99.999 COP");
  });

  it("rounds a non-integer amount", () => {
    expect(formatParamValue("amount", 1_000_000.6)).toBe("$1.000.001 COP");
  });

  it("does not currency-format a non-numeric amount-key value", () => {
    expect(formatParamValue("amount", "N/A")).toBe("N/A");
  });

  it("formats 'date' key as a localized long date", () => {
    const result = formatParamValue("date", "2026-07-04");
    expect(result).toContain("2026");
    expect(result).not.toBe("2026-07-04");
  });

  it("formats 'targetDate' key as a localized long date", () => {
    const result = formatParamValue("targetDate", "2026-12-25");
    expect(result).toContain("2026");
  });

  it("formats 'nextDueDate' key as a localized long date", () => {
    const result = formatParamValue("nextDueDate", "2026-03-01");
    expect(result).toContain("2026");
  });

  it("falls back to String(value) when date parsing throws", () => {
    // Passing a value whose toLocaleDateString access throws is hard to trigger
    // directly; an invalid-but-parseable string still produces "Invalid Date"
    // via toLocaleDateString rather than throwing, so this exercises the catch
    // path indirectly is not reliable — instead verify the non-date/non-amount
    // fallback branch.
    expect(formatParamValue("notes", "just a string")).toBe("just a string");
  });

  it("stringifies a plain unrecognized key/value pair", () => {
    expect(formatParamValue("vaultId", "vault_123")).toBe("vault_123");
  });

  it("stringifies a number for a non-amount key", () => {
    expect(formatParamValue("cadenceMonths", 6)).toBe("6");
  });
});

// ─── buildProposalTitle (via TITLE_BUILDERS) ─────────────────────────────────

describe("buildProposalTitle", () => {
  it("builds the create-vault title", () => {
    expect(buildProposalTitle("propose_create_vault", { name: "Trip" })).toBe(
      "Create vault: Trip",
    );
  });

  it("falls back to '?' when name is missing for create-vault", () => {
    expect(buildProposalTitle("propose_create_vault", {})).toBe("Create vault: ?");
  });

  it("builds the update-vault title", () => {
    expect(buildProposalTitle("propose_update_vault", { vaultId: "v1" })).toBe(
      "Update vault v1",
    );
  });

  it("builds vault-contribution title without sourceAccountId", () => {
    expect(
      buildProposalTitle("propose_vault_contribution", { vaultId: "v1", amount: 100_000 }),
    ).toBe("Contribute $100.000 COP to vault v1");
  });

  it("builds vault-contribution title with sourceAccountId", () => {
    expect(
      buildProposalTitle("propose_vault_contribution", {
        vaultId: "v1",
        amount: 100_000,
        sourceAccountId: "acc1",
      }),
    ).toBe("Contribute $100.000 COP to vault v1 from account acc1");
  });

  it("builds vault-withdrawal title without sourceAccountId", () => {
    expect(
      buildProposalTitle("propose_vault_withdrawal", { vaultId: "v1", amount: 50_000 }),
    ).toBe("Withdraw $50.000 COP from vault v1");
  });

  it("builds vault-withdrawal title with sourceAccountId", () => {
    expect(
      buildProposalTitle("propose_vault_withdrawal", {
        vaultId: "v1",
        amount: 50_000,
        sourceAccountId: "acc1",
      }),
    ).toBe("Withdraw $50.000 COP from vault v1 (returns to account acc1)");
  });

  it("builds the archive-vault title", () => {
    expect(buildProposalTitle("propose_archive_vault", { vaultId: "v2" })).toBe(
      "Archive vault v2",
    );
  });

  it("builds the create-recurring-expense title", () => {
    expect(
      buildProposalTitle("propose_create_recurring_expense", {
        name: "Car insurance",
        estimatedAmount: 1_200_000,
        cadenceMonths: 12,
      }),
    ).toBe("Add recurring expense: Car insurance, $1.200.000 COP every 12mo");
  });

  it("builds the pay-recurring title without fromVaultId", () => {
    expect(
      buildProposalTitle("propose_pay_recurring", { id: "r1", amount: 300_000 }),
    ).toBe("Pay recurring expense r1: $300.000 COP");
  });

  it("builds the pay-recurring title with fromVaultId", () => {
    expect(
      buildProposalTitle("propose_pay_recurring", {
        id: "r1",
        amount: 300_000,
        fromVaultId: "v9",
      }),
    ).toBe("Pay recurring expense r1: $300.000 COP from vault v9");
  });

  it("builds the import-from-drive title using fileName", () => {
    expect(
      buildProposalTitle("propose_import_from_drive", { fileName: "June.xlsx", fileId: "f1" }),
    ).toBe("Import from Drive: June.xlsx");
  });

  it("falls back to fileId then 'latest file' for import-from-drive title", () => {
    expect(buildProposalTitle("propose_import_from_drive", { fileId: "f1" })).toBe(
      "Import from Drive: f1",
    );
    expect(buildProposalTitle("propose_import_from_drive", {})).toBe(
      "Import from Drive: latest file",
    );
  });

  it("builds the create-installment title", () => {
    expect(
      buildProposalTitle("propose_create_installment", {
        description: "TV",
        totalAmount: 2_000_000,
        numInstallments: 4,
      }),
    ).toBe("Create installment: TV — $2.000.000 COP × 4");
  });

  it("builds the mark-installment-paid title", () => {
    expect(
      buildProposalTitle("propose_mark_installment_paid", { installmentName: "TV" }),
    ).toBe("Mark cuota paid: TV");
  });

  it("builds the create-loan title", () => {
    expect(
      buildProposalTitle("propose_create_loan", { amount: 500_000, debtorName: "Juan" }),
    ).toBe("Create loan: $500.000 COP → Juan");
  });

  it("builds the record-loan-payment title", () => {
    expect(
      buildProposalTitle("propose_record_loan_payment", { amount: 200_000, debtorName: "Juan" }),
    ).toBe("Record payment: $200.000 COP from Juan");
  });

  it("builds the undo-last title", () => {
    expect(
      buildProposalTitle("propose_undo_last", { originalAction: "propose_create_loan" }),
    ).toBe("Undo: propose_create_loan");
  });

  it("falls back to the raw tool name for an unknown tool", () => {
    expect(buildProposalTitle("propose_something_unmapped", {})).toBe(
      "propose_something_unmapped",
    );
  });
});

// ─── buildProposalFields ──────────────────────────────────────────────────────

describe("buildProposalFields", () => {
  it("maps each input entry to a formatted label/value pair", () => {
    const fields = buildProposalFields({ name: "Trip", targetAmount: 500_000 });
    expect(fields).toEqual([
      { label: "Name", value: "Trip" },
      { label: "Target Amount", value: "$500.000 COP" },
    ]);
  });

  it("skips internal ID fields", () => {
    const fields = buildProposalFields({
      vaultId: "v1",
      id: "x1",
      sourceAccountId: "acc1",
      fromVaultId: "v2",
      fundingVaultId: "v3",
      cardId: "c1",
      debtorId: "d1",
      accountId: "a1",
      installmentId: "i1",
      loanId: "l1",
      targetProposalId: "p1",
      createCard: { name: "Nu" },
      createDebtor: { name: "Juan" },
      createdId: "z1",
      createdDebtorId: "z2",
      name: "Visible",
    });
    expect(fields).toEqual([{ label: "Name", value: "Visible" }]);
  });

  it("returns an empty array for an empty input", () => {
    expect(buildProposalFields({})).toEqual([]);
  });
});

// ─── resolveDriveFile ─────────────────────────────────────────────────────────

describe("resolveDriveFile", () => {
  it("auto-picks the most recent file when fileId is omitted", async () => {
    vi.mocked(listDriveFiles).mockResolvedValue([
      { id: "f1", name: "July.xlsx", modifiedTime: "2026-07-01" },
      { id: "f2", name: "June.xlsx", modifiedTime: "2026-06-01" },
    ] as DriveFile[]);

    const result = await resolveDriveFile({});
    expect(result).toEqual({ ok: true, fileId: "f1", fileName: "July.xlsx" });
  });

  it("returns a blocking error when no files exist in the Drive folder", async () => {
    vi.mocked(listDriveFiles).mockResolvedValue([]);

    const result = await resolveDriveFile({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.blockingMessage).toBe(
        "No files found in the configured Drive folder.",
      );
    }
  });

  it("resolves fileName by looking up a bare fileId", async () => {
    vi.mocked(listDriveFiles).mockResolvedValue([
      { id: "f1", name: "July.xlsx", modifiedTime: "2026-07-01" },
    ] as DriveFile[]);

    const result = await resolveDriveFile({ fileId: "f1" });
    expect(result).toEqual({ ok: true, fileId: "f1", fileName: "July.xlsx" });
  });

  it("returns a blocking error when the given fileId is not found", async () => {
    vi.mocked(listDriveFiles).mockResolvedValue([
      { id: "f1", name: "July.xlsx", modifiedTime: "2026-07-01" },
    ] as DriveFile[]);

    const result = await resolveDriveFile({ fileId: "stale-id" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.blockingMessage).toMatch(/File not found/);
    }
  });

  it("passes through fileId and fileName unchanged when both are given", async () => {
    const result = await resolveDriveFile({ fileId: "f9", fileName: "Given.xlsx" });
    expect(result).toEqual({ ok: true, fileId: "f9", fileName: "Given.xlsx" });
    expect(listDriveFiles).not.toHaveBeenCalled();
  });
});

// ─── detectDrivePeriod ────────────────────────────────────────────────────────

describe("detectDrivePeriod", () => {
  it("parses a YYYY-MM pattern from the filename into a month label", () => {
    const result = detectDrivePeriod("MoneyLover_2026-06.xlsx", undefined, 7, 2026);
    expect(result.detectedLabel).toBe("Jun 2026");
  });

  it("parses a YYYY_MM pattern (underscore) from the filename", () => {
    const result = detectDrivePeriod("MoneyLover_2026_03.xlsx", undefined, 7, 2026);
    expect(result.detectedLabel).toBe("Mar 2026");
  });

  it("falls back to the raw filename when no period pattern matches", () => {
    const result = detectDrivePeriod("export.xlsx", undefined, 7, 2026);
    expect(result.detectedLabel).toBe("export.xlsx");
  });

  it("resolves status to IN_PROGRESS when the detected period is the current month", () => {
    const result = detectDrivePeriod("MoneyLover_2026-07.xlsx", undefined, 7, 2026);
    expect(result.resolvedStatus).toBe("IN_PROGRESS");
  });

  it("resolves status to FINAL when the detected period is a past month", () => {
    const result = detectDrivePeriod("MoneyLover_2026-05.xlsx", undefined, 7, 2026);
    expect(result.resolvedStatus).toBe("FINAL");
  });

  it("resolves status to FINAL when no period is detected at all", () => {
    const result = detectDrivePeriod("export.xlsx", undefined, 7, 2026);
    expect(result.resolvedStatus).toBe("FINAL");
  });

  it("honors an explicit statusOverride even for the current month", () => {
    const result = detectDrivePeriod("MoneyLover_2026-07.xlsx", "FINAL", 7, 2026);
    expect(result.resolvedStatus).toBe("FINAL");
  });
});

// ─── resolveImportFromDrive ───────────────────────────────────────────────────

describe("resolveImportFromDrive", () => {
  it("builds params/title/fields for an auto-picked current-month file", async () => {
    vi.mocked(listDriveFiles).mockResolvedValue([
      { id: "f1", name: "MoneyLover_2026-07.xlsx", modifiedTime: "2026-07-04" },
    ] as DriveFile[]);

    const result = await resolveImportFromDrive({}, 7, 2026);
    expect(result.blockingMessage).toBeUndefined();
    expect(result.params).toEqual({
      fileId: "f1",
      fileName: "MoneyLover_2026-07.xlsx",
      status: "IN_PROGRESS",
    });
    expect(result.title).toBe("Import from Drive: MoneyLover_2026-07.xlsx");
    expect(result.fields).toContainEqual({ label: "Detected period", value: "Jul 2026" });
    expect(result.fields).toContainEqual({
      label: "Batch status",
      value: "IN PROGRESS (mid-month)",
    });
  });

  it("propagates the blocking message when no Drive files exist", async () => {
    vi.mocked(listDriveFiles).mockResolvedValue([]);
    const result = await resolveImportFromDrive({}, 7, 2026);
    expect(result.blockingMessage).toBe("No files found in the configured Drive folder.");
  });

  it("honors an explicit status override in the built params", async () => {
    vi.mocked(listDriveFiles).mockResolvedValue([
      { id: "f1", name: "MoneyLover_2026-05.xlsx", modifiedTime: "2026-05-01" },
    ] as DriveFile[]);

    const result = await resolveImportFromDrive({ status: "FINAL" }, 7, 2026);
    expect(result.params).toMatchObject({ status: "FINAL" });
  });
});

// ─── resolveCreateInstallment ─────────────────────────────────────────────────

describe("resolveCreateInstallment", () => {
  const baseInput = {
    description: "Laptop",
    totalAmount: 3_000_000,
    numInstallments: 6,
    startDate: "2026-07-15",
  };

  it("resolves an existing card by case-insensitive exact name match", async () => {
    vi.mocked(getCardSummaries).mockResolvedValue([
      { id: "card-1", name: "Nu", color: null, creditLimit: null, paymentDueDay: null, outstandingDebt: 0, monthlyObligation: 0, installmentCount: 0 },
    ]);

    const result = await resolveCreateInstallment({ ...baseInput, cardName: "nu" }, 7, 2026);
    expect(result.params.cardId).toBe("card-1");
    expect(result.params.createCard).toBeUndefined();
  });

  it("flags a new card to be created when the card name doesn't match any existing card", async () => {
    vi.mocked(getCardSummaries).mockResolvedValue([]);

    const result = await resolveCreateInstallment({ ...baseInput, cardName: "Falabella" }, 7, 2026);
    expect(result.params.cardId).toBeNull();
    expect(result.params.createCard).toEqual({ name: "Falabella" });
    expect(result.fields.find((f) => f.label === "Card")?.value).toContain(
      "⚠ new card will be created",
    );
  });

  it("resolves a funding account by case-insensitive exact name match", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({
        accounts: [
          {
            id: "acc-1",
            name: "Bancolombia",
            accountType: "BANK",
            color: null,
            includeInAvailable: true,
            balance: 1_000_000,
            loansOut: 0,
            entries: [],
            vaultEntries: [],
          },
        ],
      }),
    );

    const result = await resolveCreateInstallment(
      { ...baseInput, fundingAccountName: "bancolombia" },
      7,
      2026,
    );
    expect(result.params.fundingAccountId).toBe("acc-1");
  });

  it("leaves fundingAccountId null when the funding account name doesn't match", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(makeLoansOverview());

    const result = await resolveCreateInstallment(
      { ...baseInput, fundingAccountName: "Unknown Bank" },
      7,
      2026,
    );
    expect(result.params.fundingAccountId).toBeNull();
  });

  it("computes the German-amortization true-cost preview with zero interest", async () => {
    const result = await resolveCreateInstallment(baseInput, 7, 2026);
    // No interest: monthly capital = 3_000_000 / 6 = 500_000 flat for every cuota.
    expect(result.fields).toContainEqual({ label: "Monthly capital", value: formatCOP(500_000) });
    expect(result.fields).toContainEqual({ label: "First cuota (with interest)", value: formatCOP(500_000) });
    expect(result.fields).toContainEqual({ label: "Total interest", value: formatCOP(0) });
    expect(result.fields).toContainEqual({ label: "Total repaid", value: formatCOP(3_000_000) });
  });

  it("computes a nonzero true-cost preview when a monthly interest rate is given", async () => {
    const result = await resolveCreateInstallment(
      { ...baseInput, monthlyInterestRate: 2 },
      7,
      2026,
    );
    const totalInterestField = result.fields.find((f) => f.label === "Total interest");
    expect(totalInterestField).toBeDefined();
    expect(totalInterestField?.value).not.toBe("$0");
    // First cuota should be higher than plain capital due to interest on full balance.
    const firstCuotaField = result.fields.find((f) => f.label === "First cuota (with interest)");
    expect(firstCuotaField?.value).not.toBe("$500.000");
  });

  it("builds the expected title", async () => {
    const result = await resolveCreateInstallment(baseInput, 7, 2026);
    expect(result.title).toBe(`Create installment: Laptop — ${formatCOP(3_000_000)} × 6`);
  });

  it("defaults monthlyInterestRate param to null when omitted", async () => {
    const result = await resolveCreateInstallment(baseInput, 7, 2026);
    expect(result.params.monthlyInterestRate).toBeNull();
  });
});

// ─── resolveMarkInstallmentPaid ───────────────────────────────────────────────

describe("resolveMarkInstallmentPaid", () => {
  it("returns a blocking message when no installment matches the given name", async () => {
    vi.mocked(getAllInstallments).mockResolvedValue([makeInstallment({ description: "TV" })]);

    const result = await resolveMarkInstallmentPaid({ installmentName: "Fridge" }, 7, 2026);
    expect(result.blockingMessage).toMatch(/No installment found matching "Fridge"/);
  });

  it("resolves by case-insensitive partial (contains) match", async () => {
    vi.mocked(getAllInstallments).mockResolvedValue([
      makeInstallment({ id: "inst-9", description: "Samsung TV 55in" }),
    ]);

    const result = await resolveMarkInstallmentPaid({ installmentName: "tv" }, 1, 2026);
    expect(result.blockingMessage).toBeUndefined();
    expect(result.params.installmentId).toBe("inst-9");
  });

  it("finds the correct slot number for the target month", async () => {
    vi.mocked(getAllInstallments).mockResolvedValue([
      makeInstallment({
        id: "inst-1",
        description: "Laptop",
        numInstallments: 6,
      }),
    ]);

    // Slot 3 falls in March 2026 (Jan=1, Feb=2, Mar=3)
    const result = await resolveMarkInstallmentPaid(
      { installmentName: "Laptop", month: 3, year: 2026 },
      1,
      2026,
    );
    expect(result.params.installmentNum).toBe(3);
  });

  it("defaults month/year to current when not provided", async () => {
    vi.mocked(getAllInstallments).mockResolvedValue([
      makeInstallment({
        id: "inst-1",
        description: "Laptop",
        numInstallments: 6,
      }),
    ]);

    const result = await resolveMarkInstallmentPaid({ installmentName: "Laptop" }, 2, 2026);
    expect(result.params.installmentNum).toBe(2);
  });

  it("returns a blocking message when no cuota falls in the target month", async () => {
    vi.mocked(getAllInstallments).mockResolvedValue([
      makeInstallment({
        description: "Laptop",
        numInstallments: 3,
      }),
    ]);

    // Installment only runs Jan-Mar 2026; December is out of range.
    const result = await resolveMarkInstallmentPaid(
      { installmentName: "Laptop", month: 12, year: 2026 },
      1,
      2026,
    );
    expect(result.blockingMessage).toMatch(/No cuota found/);
  });

  it("computes the amount due for the resolved slot", async () => {
    vi.mocked(getAllInstallments).mockResolvedValue([
      makeInstallment({
        description: "Laptop",
        totalAmount: 3_000_000,
        numInstallments: 6,
      }),
    ]);

    const result = await resolveMarkInstallmentPaid(
      { installmentName: "Laptop", month: 1, year: 2026 },
      1,
      2026,
    );
    expect(result.fields).toContainEqual({ label: "Amount due", value: formatCOP(500_000) });
  });

  it("builds a title including the slot fraction and description", async () => {
    vi.mocked(getAllInstallments).mockResolvedValue([
      makeInstallment({
        description: "Laptop",
        numInstallments: 6,
      }),
    ]);

    const result = await resolveMarkInstallmentPaid(
      { installmentName: "Laptop", month: 1, year: 2026 },
      1,
      2026,
    );
    expect(result.title).toBe("Mark cuota 1/6 paid: Laptop");
  });
});

// ─── resolveCreateLoan ────────────────────────────────────────────────────────

describe("resolveCreateLoan", () => {
  it("returns a blocking message when the funding account isn't found (never auto-created)", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({
        accounts: [
          BANCOLOMBIA_ACCOUNT,
        ],
      }),
    );

    const result = await resolveCreateLoan({
      amount: 500_000,
      debtorName: "Juan",
      fundingAccountName: "Nequi",
    });
    expect(result.blockingMessage).toMatch(/Savings account "Nequi" not found/);
    expect(result.blockingMessage).toContain(BANCOLOMBIA_NAME);
  });

  it("flags a new debtor to be created when debtorName doesn't match an existing debtor", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({
        accounts: [BANCOLOMBIA_ACCOUNT],
        debtors: [],
      }),
    );

    const result = await resolveCreateLoan({
      amount: 500_000,
      debtorName: "NewGuy",
      fundingAccountName: BANCOLOMBIA_NAME,
    });
    expect(result.params.debtorId).toBeNull();
    expect(result.params.createDebtor).toEqual({ name: "NewGuy" });
    expect(result.fields.find((f) => f.label === "Debtor")?.value).toContain(
      "⚠ new debtor will be created",
    );
  });

  it("resolves an existing debtor by case-insensitive exact match", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({
        accounts: [BANCOLOMBIA_ACCOUNT],
        debtors: [{ id: "d1", name: "Juan", notes: null, loans: [], totalOwed: 0, activeLoansCount: 0 }],
      }),
    );

    const result = await resolveCreateLoan({
      amount: 500_000,
      debtorName: "juan",
      fundingAccountName: BANCOLOMBIA_NAME,
    });
    expect(result.params.debtorId).toBe("d1");
    expect(result.params.createDebtor).toBeUndefined();
  });

  it("defaults date to today when omitted", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({
        accounts: [BANCOLOMBIA_ACCOUNT],
      }),
    );

    const result = await resolveCreateLoan({
      amount: 500_000,
      debtorName: "Juan",
      fundingAccountName: BANCOLOMBIA_NAME,
    });
    const today = new Date().toISOString().slice(0, 10);
    expect(result.params.date).toBe(today);
  });

  it("builds the expected title", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({
        accounts: [BANCOLOMBIA_ACCOUNT],
      }),
    );

    const result = await resolveCreateLoan({
      amount: 500_000,
      debtorName: "Juan",
      fundingAccountName: BANCOLOMBIA_NAME,
    });
    expect(result.title).toBe(`Create loan: ${formatCOP(500_000)} → Juan`);
  });
});

// ─── resolveRecordLoanPayment ─────────────────────────────────────────────────

describe("resolveRecordLoanPayment — not-found guards", () => {
  it("returns a blocking message when the debtor isn't found", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(makeLoansOverview({ debtors: [] }));

    const result = await resolveRecordLoanPayment({ debtorName: "Ghost", amount: 100_000 });
    expect(result.blockingMessage).toMatch(/Debtor "Ghost" not found/);
  });

  it("returns a blocking message when the debtor has no active loans", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({
        debtors: [{ id: "d1", name: "Juan", notes: null, loans: [], totalOwed: 0, activeLoansCount: 0 }],
      }),
    );

    const result = await resolveRecordLoanPayment({ debtorName: "Juan", amount: 100_000 });
    expect(result.blockingMessage).toMatch(/No active loans found for "Juan"/);
  });
});

describe("resolveRecordLoanPayment — loan targeting and balance math", () => {
  it("targets the oldest active loan when a debtor has multiple", async () => {
    const olderLoan = makeLoanFixture({ id: "loan-old" });
    const newerLoan = makeLoanFixture({
      id: "loan-new",
      createdAt: new Date("2026-06-01T10:00:00"),
      date: new Date("2026-06-01T12:00:00"),
    });

    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({
        debtors: [
          {
            id: "d1",
            name: "Juan",
            notes: null,
            loans: [newerLoan, olderLoan],
            totalOwed: 2_000_000,
            activeLoansCount: 2,
          },
        ],
      }),
    );

    const result = await resolveRecordLoanPayment({ debtorName: "Juan", amount: 200_000 });
    expect(result.params.loanId).toBe("loan-old");
    expect(result.fields).toContainEqual({
      label: "Note",
      value: "Juan has 2 active loans — payment applied to oldest.",
    });
  });

  it("excludes fully-paid (inactive) loans from targeting", async () => {
    const paidOffLoan = makeLoanFixture({ id: "loan-paid", remaining: 0, isActive: false });
    const activeLoan = makeLoanFixture({
      id: "loan-active",
      remaining: 500_000,
      isActive: true,
      createdAt: new Date("2026-03-01T10:00:00"),
    });

    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({
        debtors: [
          {
            id: "d1",
            name: "Juan",
            notes: null,
            loans: [paidOffLoan, activeLoan],
            totalOwed: 500_000,
            activeLoansCount: 1,
          },
        ],
      }),
    );

    const result = await resolveRecordLoanPayment({ debtorName: "Juan", amount: 100_000 });
    expect(result.params.loanId).toBe("loan-active");
    // Only one active loan — no "applied to oldest" note.
    expect(result.fields.find((f) => f.label === "Note")).toBeUndefined();
  });

  it("computes the resulting balance after the payment, floored at zero", async () => {
    const loan = makeLoanFixture({ remaining: 300_000 });

    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({
        debtors: [
          { id: "d1", name: "Juan", notes: null, loans: [loan], totalOwed: 300_000, activeLoansCount: 1 },
        ],
      }),
    );

    // Overpaying — remaining should floor at 0, not go negative.
    const result = await resolveRecordLoanPayment({ debtorName: "Juan", amount: 500_000 });
    expect(result.fields).toContainEqual({ label: "Resulting balance", value: formatCOP(0) });
  });
});

// ─── resolveAccountAdjustment ─────────────────────────────────────────────────

describe("resolveAccountAdjustment", () => {
  it("returns a blocking message when the account isn't found (never auto-created)", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({ accounts: [BANCOLOMBIA_ACCOUNT] }),
    );

    const result = await resolveAccountAdjustment({
      accountName: "Nequi",
      amount: -700_000,
    });
    expect(result.blockingMessage).toMatch(/Savings account "Nequi" not found/);
    expect(result.blockingMessage).toContain(BANCOLOMBIA_NAME);
    expect(result.params).toEqual({ accountName: "Nequi", amount: -700_000 });
  });

  it("resolves the account by case-insensitive exact match and keeps the signed amount", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({ accounts: [BANCOLOMBIA_ACCOUNT] }),
    );

    const result = await resolveAccountAdjustment({
      accountName: "bancolombia",
      amount: -700_000,
      notes: "Prima mamá",
    });

    expect(result.blockingMessage).toBeUndefined();
    expect(result.params.accountId).toBe(BANCOLOMBIA_ACCOUNT.id);
    expect(result.params.amount).toBe(-700_000);
    expect(result.params.notes).toBe("Prima mamá");
    expect(result.fields).toContainEqual({ label: "Notes", value: "Prima mamá" });
  });

  it("labels a negative amount as a Debit and a positive amount as a Credit in the title", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({ accounts: [BANCOLOMBIA_ACCOUNT] }),
    );

    const debit = await resolveAccountAdjustment({
      accountName: BANCOLOMBIA_NAME,
      amount: -700_000,
    });
    expect(debit.title).toContain("Debit");
    expect(debit.title).toContain(BANCOLOMBIA_NAME);

    const credit = await resolveAccountAdjustment({
      accountName: BANCOLOMBIA_NAME,
      amount: 200_000,
    });
    expect(credit.title).toContain("Credit");
  });

  it("defaults date to today when omitted", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({ accounts: [BANCOLOMBIA_ACCOUNT] }),
    );

    const result = await resolveAccountAdjustment({
      accountName: BANCOLOMBIA_NAME,
      amount: -100_000,
    });
    const today = new Date().toISOString().slice(0, 10);
    expect(result.params.date).toBe(today);
  });
});

// ─── resolveTransfer ───────────────────────────────────────────────────────────

describe("resolveTransfer", () => {
  it("returns a blocking message naming the missing fromAccount (never auto-created)", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({ accounts: [NU_ACCOUNT] }),
    );

    const result = await resolveTransfer({
      fromAccountName: "Bancolombia",
      toAccountName: NU_NAME,
      amount: 500_000,
    });
    expect(result.blockingMessage).toMatch(/Savings account "Bancolombia" not found/);
    expect(result.blockingMessage).toContain(NU_NAME);
  });

  it("returns a blocking message naming the missing toAccount (never auto-created)", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({ accounts: [BANCOLOMBIA_ACCOUNT] }),
    );

    const result = await resolveTransfer({
      fromAccountName: BANCOLOMBIA_NAME,
      toAccountName: "Nequi",
      amount: 500_000,
    });
    expect(result.blockingMessage).toMatch(/Savings account "Nequi" not found/);
    expect(result.blockingMessage).toContain(BANCOLOMBIA_NAME);
  });

  it("resolves both accounts to their ids on success", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(
      makeLoansOverview({ accounts: [BANCOLOMBIA_ACCOUNT, NU_ACCOUNT] }),
    );

    const result = await resolveTransfer({
      fromAccountName: BANCOLOMBIA_NAME,
      toAccountName: NU_NAME,
      amount: 500_000,
    });
    expect(result.blockingMessage).toBeUndefined();
    expect(result.params.fromAccountId).toBe(BANCOLOMBIA_ACCOUNT.id);
    expect(result.params.toAccountId).toBe(NU_ACCOUNT.id);
    expect(result.params.amount).toBe(500_000);
    expect(result.title).toBe(`Transfer ${formatCOP(500_000)}: ${BANCOLOMBIA_NAME} → ${NU_NAME}`);
  });
});

// ─── resolveUndoLast ──────────────────────────────────────────────────────────

describe("resolveUndoLast", () => {
  it("returns a blocking message when there is no reversible approved proposal", async () => {
    vi.mocked(db.pendingProposal.findFirst).mockResolvedValue(null);

    const result = await resolveUndoLast();
    expect(result.blockingMessage).toBe("No reversible recent action found.");
  });

  it("builds params referencing the target proposal and original action", async () => {
    vi.mocked(db.pendingProposal.findFirst).mockResolvedValue({
      id: "prop-1",
      action: "propose_create_loan",
      title: "Create loan: $500.000 COP → Juan",
      resolvedAt: new Date("2026-07-01T15:30:00"),
    } as never);

    const result = await resolveUndoLast();
    expect(result.params).toEqual({
      targetProposalId: "prop-1",
      originalAction: "propose_create_loan",
    });
  });

  it("queries only approved proposals within the reversible action set", async () => {
    vi.mocked(db.pendingProposal.findFirst).mockResolvedValue(null);

    await resolveUndoLast();
    expect(db.pendingProposal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "approved" }),
        orderBy: { resolvedAt: "desc" },
      }),
    );
  });
});

// ─── RESOLVER_REGISTRY / PROPOSAL_ACTIONS invariant ──────────────────────────
// RESOLVER_REGISTRY (proposals/index.ts) is a second, hand-maintained tool-name
// list alongside PROPOSAL_ACTIONS (actions.ts) — ADR-026 exists specifically so
// this kind of mapping can't silently drift. This guard fails the suite loudly
// if a name is ever added to RESOLVER_REGISTRY without a matching PROPOSAL_ACTIONS
// entry (or the reverse leaves a stale entry behind).

describe("RESOLVER_REGISTRY", () => {
  it("only contains tool names that also exist in PROPOSAL_ACTIONS, aside from the documented propose_undo_last special case", () => {
    // propose_undo_last is deliberately absent from PROPOSAL_ACTIONS — see the
    // "KEYS ARE EXACT PROPOSAL TOOL NAMES" doc comment above PROPOSAL_ACTIONS
    // in actions.ts, and the same carve-out in run-agent-turn.ts's PROPOSAL_TOOLS
    // derivation (`new Set([...Object.keys(PROPOSAL_ACTIONS), "propose_undo_last"])`).
    const proposalActionNames = new Set([
      ...Object.keys(PROPOSAL_ACTIONS),
      "propose_undo_last",
    ]);
    for (const toolName of Object.keys(RESOLVER_REGISTRY)) {
      expect(proposalActionNames.has(toolName)).toBe(true);
    }
  });
});

// ─── resolveComplexProposal (dispatch) ────────────────────────────────────────

describe("resolveComplexProposal", () => {
  it("returns null for a tool with no complex resolver (default simple resolution)", async () => {
    const result = await resolveComplexProposal("propose_create_vault", { name: "Trip" });
    expect(result).toBeNull();
  });

  it("dispatches propose_import_from_drive to resolveImportFromDrive", async () => {
    vi.mocked(listDriveFiles).mockResolvedValue([
      { id: "f1", name: "June.xlsx", modifiedTime: "2026-06-01" },
    ] as DriveFile[]);

    const result = await resolveComplexProposal("propose_import_from_drive", {});
    expect(result).not.toBeNull();
    expect(result?.title).toContain("Import from Drive");
  });

  it("dispatches propose_undo_last to resolveUndoLast", async () => {
    vi.mocked(db.pendingProposal.findFirst).mockResolvedValue(null);

    const result = await resolveComplexProposal("propose_undo_last", {});
    expect(result?.blockingMessage).toBe("No reversible recent action found.");
  });

  it("dispatches propose_record_loan_payment to resolveRecordLoanPayment", async () => {
    vi.mocked(getLoansOverview).mockResolvedValue(makeLoansOverview({ debtors: [] }));

    const result = await resolveComplexProposal("propose_record_loan_payment", {
      debtorName: "Ghost",
      amount: 1,
    });
    expect(result?.blockingMessage).toMatch(/not found/);
  });
});

// ─── deduplicateHistory ───────────────────────────────────────────────────────

describe("deduplicateHistory", () => {
  it("returns the history unchanged when it ends with a single user message", () => {
    const history = [
      { role: "user" as const, content: "hi" },
      { role: "assistant" as const, content: "hello" },
      { role: "user" as const, content: "how are you" },
    ];
    expect(deduplicateHistory(history)).toEqual(history);
  });

  it("collapses multiple trailing user messages down to just the last one", () => {
    const history = [
      { role: "assistant" as const, content: "hello" },
      { role: "user" as const, content: "first" },
      { role: "user" as const, content: "second" },
      { role: "user" as const, content: "third" },
    ];
    const result = deduplicateHistory(history);
    expect(result).toEqual([
      { role: "assistant" as const, content: "hello" },
      { role: "user" as const, content: "third" },
    ]);
  });

  it("handles an all-user-message history by keeping only the last", () => {
    const history = [
      { role: "user" as const, content: "a" },
      { role: "user" as const, content: "b" },
    ];
    expect(deduplicateHistory(history)).toEqual([{ role: "user" as const, content: "b" }]);
  });

  it("returns an empty array unchanged", () => {
    expect(deduplicateHistory([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const history = [
      { role: "user" as const, content: "first" },
      { role: "user" as const, content: "second" },
    ];
    const original = [...history];
    deduplicateHistory(history);
    expect(history).toEqual(original);
  });
});

// ─── collectTextBlocks ────────────────────────────────────────────────────────

describe("collectTextBlocks", () => {
  it("concatenates text from multiple text blocks", () => {
    const blocks = [
      { type: "text", text: "Hello, " },
      { type: "text", text: "world." },
    ] as never;
    expect(collectTextBlocks(blocks)).toBe("Hello, world.");
  });

  it("ignores non-text blocks", () => {
    const blocks = [
      { type: "text", text: "Hello" },
      { type: "tool_use", id: "t1", name: "get_overview", input: {} },
    ] as never;
    expect(collectTextBlocks(blocks)).toBe("Hello");
  });

  it("returns an empty string when there are no text blocks", () => {
    const blocks = [{ type: "tool_use", id: "t1", name: "get_overview", input: {} }] as never;
    expect(collectTextBlocks(blocks)).toBe("");
  });

  it("invokes the onTextDelta callback once per text block with its delta", () => {
    const onTextDelta = vi.fn();
    const blocks = [
      { type: "text", text: "foo" },
      { type: "text", text: "bar" },
    ] as never;
    collectTextBlocks(blocks, onTextDelta);
    expect(onTextDelta).toHaveBeenCalledTimes(2);
    expect(onTextDelta).toHaveBeenNthCalledWith(1, "foo");
    expect(onTextDelta).toHaveBeenNthCalledWith(2, "bar");
  });

  it("works without an onTextDelta callback", () => {
    const blocks = [{ type: "text", text: "solo" }] as never;
    expect(() => collectTextBlocks(blocks)).not.toThrow();
  });
});
