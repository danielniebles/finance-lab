// Tool schemas (JSON schema definitions the model sees) — a distinct
// concern from both dispatch (read-tools.ts, proposals/) and turn
// orchestration (run-agent-turn.ts). Split out of run-agent-turn.ts
// (see docs/backlog.md god-file item).

import type Anthropic from "@anthropic-ai/sdk";

const YEAR_DESC = "4-digit year";

export const TOOLS: Anthropic.Tool[] = [
  // ── Read tools ──
  {
    name: "get_overview",
    description:
      "Get a high-level financial briefing across all modules: expenses, savings, installments, loans, and vaults. Call this first when the user asks a general question about their finances.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_available_months",
    description: "Get the list of months that have imported expense data.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_monthly_analysis",
    description:
      "Get the full budget/actual/severity breakdown for a specific month. Use this when the user asks about a particular month's expenses.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "number", description: "Month number (1–12)" },
        year: { type: "number", description: YEAR_DESC },
      },
      required: ["month", "year"],
    },
  },
  {
    name: "get_transactions",
    description:
      "Get individual transactions for a month, optionally filtered by category name.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "number", description: "Month number (1–12)" },
        year: { type: "number", description: YEAR_DESC },
        category: {
          type: "string",
          description: "Optional: filter by app category name (case-insensitive partial match)",
        },
      },
      required: ["month", "year"],
    },
  },
  {
    name: "get_trends",
    description:
      "Get multi-month income/expense/savings-rate trend data. Defaults to last 6 months.",
    input_schema: {
      type: "object",
      properties: {
        n: {
          type: "number",
          description: "Number of months to look back (default 6, max 12)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_installments",
    description:
      "Get all installments (active and finished) plus the current month obligation summary.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_loans",
    description:
      "Get savings accounts, debtors, active loans, and liquidity KPIs.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_vaults",
    description:
      "Get all active vaults with their computed balance, progress, required-this-month, and status.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_vault_obligations",
    description:
      "Get per-vault required/contributed/still-needed amounts for a specific month.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "number", description: "Month number (1–12)" },
        year: { type: "number", description: YEAR_DESC },
      },
      required: ["month", "year"],
    },
  },
  {
    name: "get_categories",
    description:
      "Get all AppCategories (id, name, budgetType). Call this before proposing a transaction to guess the best category and build the editable option shortlist.",
    input_schema: { type: "object", properties: {}, required: [] },
  },

  // ── Proposal tools ──
  {
    name: "propose_create_vault",
    description:
      "Propose creating a new vault. Emits an action card for the user to approve — does NOT mutate data.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Vault name" },
        kind: {
          type: "string",
          enum: ["MANDATORY", "LEISURE"],
          description: "Vault kind",
        },
        goalType: {
          type: "string",
          enum: ["FIXED_DEADLINE", "OPEN_ENDED", "RECURRING"],
          description: "Vault goal type",
        },
        targetAmount: {
          type: "number",
          description: "Required for FIXED_DEADLINE — target amount in COP",
        },
        targetDate: {
          type: "string",
          description:
            "Required for FIXED_DEADLINE — ISO date string (YYYY-MM-DD)",
        },
      },
      required: ["name", "goalType"],
    },
  },
  {
    name: "propose_update_vault",
    description:
      "Propose updating an existing vault's fields. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        vaultId: { type: "string", description: "Vault ID to update" },
        name: { type: "string" },
        kind: { type: "string", enum: ["MANDATORY", "LEISURE"] },
        goalType: { type: "string", enum: ["FIXED_DEADLINE", "OPEN_ENDED"] },
        targetAmount: { type: "number" },
        targetDate: { type: "string" },
        color: { type: "string" },
        notes: { type: "string" },
      },
      required: ["vaultId"],
    },
  },
  {
    name: "propose_vault_contribution",
    description:
      "Propose adding a contribution (positive entry) to a vault. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        vaultId: { type: "string", description: "Vault ID" },
        amount: {
          type: "number",
          description: "Contribution amount in COP (positive)",
        },
        date: {
          type: "string",
          description: "Optional ISO date (YYYY-MM-DD), defaults to today",
        },
        notes: { type: "string", description: "Optional notes" },
        sourceAccountId: {
          type: "string",
          description: "Optional savings account ID to source the funds from. When set, the amount is deducted from that account's available balance (real money movement). Omit for a notional earmark that does not affect account balances.",
        },
      },
      required: ["vaultId", "amount"],
    },
  },
  {
    name: "propose_vault_withdrawal",
    description:
      "Propose a withdrawal (negative entry) from a vault. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        vaultId: { type: "string", description: "Vault ID" },
        amount: {
          type: "number",
          description: "Withdrawal amount in COP (positive — will be negated)",
        },
        date: {
          type: "string",
          description: "Optional ISO date (YYYY-MM-DD)",
        },
        notes: { type: "string", description: "Optional notes" },
        sourceAccountId: {
          type: "string",
          description: "Optional savings account ID that originally funded this vault (for returning money). When set, the withdrawal increases that account's available balance.",
        },
      },
      required: ["vaultId", "amount"],
    },
  },
  {
    name: "propose_archive_vault",
    description:
      "Propose archiving a vault (met goal or abandoned). Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        vaultId: { type: "string", description: "Vault ID to archive" },
      },
      required: ["vaultId"],
    },
  },

  // ── Recurring expense tools ──
  {
    name: "get_recurring_expenses",
    description:
      "Get all active recurring expenses with computed set-aside amounts and status for a given month. Use this when the user asks about upcoming bills, what they need to save this month, or recurring obligations.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "number", description: "Month number (1-12)" },
        year: { type: "number", description: YEAR_DESC },
      },
      required: ["month", "year"],
    },
  },
  {
    name: "get_forecast",
    description:
      "Get a historical forecast for a given month: projected savings rate, per-category landing ranges, and top overspend drivers. Based on past import data only — labels outputs as projections, returns insufficient history if < 3 months of data.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "number", description: "Month number (1–12)" },
        year: { type: "number", description: YEAR_DESC },
      },
      required: ["month", "year"],
    },
  },
  {
    name: "propose_create_recurring_expense",
    description:
      "Propose registering a new recurring expense. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        estimatedAmount: { type: "number", description: "Estimated amount in COP" },
        cadenceMonths: {
          type: "number",
          description: "Recurrence in months (1=monthly, 6=semiannual, 12=annual)",
        },
        nextDueDate: { type: "string", description: "Next due date (YYYY-MM-DD)" },
        category: { type: "string" },
        fundingVaultId: {
          type: "string",
          description: "ID of a RECURRING vault to link",
        },
      },
      required: ["name", "estimatedAmount", "cadenceMonths", "nextDueDate"],
    },
  },
  {
    name: "propose_pay_recurring",
    description:
      "Propose recording a payment for a recurring expense and rolling its cycle forward. Optionally withdraws from a linked vault. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "RecurringExpense ID" },
        amount: { type: "number", description: "Actual amount paid in COP" },
        fromVaultId: {
          type: "string",
          description: "Vault ID to withdraw from (optional)",
        },
      },
      required: ["id", "amount"],
    },
  },

  // ── Drive import tool ──
  {
    name: "list_drive_files",
    description: "List MoneyLover XLSX files available in the configured Google Drive folder, ordered by most recently modified.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "propose_import_from_drive",
    description:
      "Propose importing a MoneyLover file from Google Drive. If no fileId is specified, auto-picks the most recent file. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "Drive file ID (optional — auto-picks most recent if omitted)" },
        fileName: { type: "string", description: "The file name from the list_drive_files result; pass it alongside fileId" },
        status: {
          type: "string",
          enum: ["IN_PROGRESS", "FINAL"],
          description: "Override batch status (optional — heuristic default: current month → IN_PROGRESS, past month → FINAL)",
        },
      },
      required: [],
    },
  },

  // ── Installment tools ──
  {
    name: "propose_create_installment",
    description:
      "Propose registering a new installment (cuota purchase). Shows a true-cost preview including interest. Emits an action card — does NOT mutate. Call get_installments first to check existing cards.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Item description" },
        totalAmount: { type: "number", description: "Total purchase amount in COP" },
        numInstallments: { type: "number", description: "Number of installments" },
        monthlyInterestRate: { type: "number", description: "Monthly interest rate % (optional, 0 if none)" },
        startDate: { type: "string", description: "ISO date of first payment (YYYY-MM-DD)" },
        cardName: { type: "string", description: "Credit card name (optional). If it does not exist, a new card will be created." },
        fundingAccountName: { type: "string", description: "Savings account name to fund this (optional, only when bought for a debtor)" },
      },
      required: ["description", "totalAmount", "numInstallments", "startDate"],
    },
  },
  {
    name: "propose_mark_installment_paid",
    description:
      "Propose marking a cuota as paid for a given month. Call get_installments first to resolve the installment name and find the correct slot. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        installmentName: { type: "string", description: "Description of the installment (partial match OK)" },
        month: { type: "number", description: "Month number (1–12), defaults to current month" },
        year: { type: "number", description: "4-digit year, defaults to current year" },
      },
      required: ["installmentName"],
    },
  },

  // ── Loan tools ──
  {
    name: "propose_create_loan",
    description:
      "Propose recording a new loan to a debtor, sourced from a savings account. Call get_loans first to resolve names. If the debtor doesn't exist they will be created in the same proposal. Savings accounts CANNOT be auto-created — ask the user which account to use. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Loan amount in COP" },
        debtorName: { type: "string", description: "Debtor name (existing or new)" },
        fundingAccountName: { type: "string", description: "Savings account name to source from (must exist)" },
        date: { type: "string", description: "Loan date ISO (YYYY-MM-DD), defaults to today" },
        expectedBy: { type: "string", description: "Expected repayment date ISO (optional)" },
        notes: { type: "string", description: "Notes (optional)" },
      },
      required: ["amount", "debtorName", "fundingAccountName"],
    },
  },
  {
    name: "propose_record_loan_payment",
    description:
      "Propose recording a repayment received from a debtor. Call get_loans first to resolve debtor and loan. If debtor has multiple active loans, the oldest is targeted. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        debtorName: { type: "string", description: "Debtor name" },
        amount: { type: "number", description: "Payment amount in COP" },
        date: { type: "string", description: "Payment date ISO (YYYY-MM-DD), defaults to today" },
        notes: { type: "string", description: "Notes (optional)" },
      },
      required: ["debtorName", "amount"],
    },
  },

  // ── Savings account tools ──
  {
    name: "propose_account_adjustment",
    description:
      "Propose a direct debit/credit/correction on a savings account you control — money entering or leaving the account with no repayment expected (e.g. a gift, a direct expense, a balance correction). Signed amount: negative = money out, positive = money in. Call get_loans first to resolve the account name. Savings accounts CANNOT be auto-created — ask the user which account to use if not found. Do NOT use for money expected back from a debtor (use propose_create_loan) or for vault balances (use propose_vault_contribution/propose_vault_withdrawal). Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        accountName: { type: "string", description: "Savings account name (must exist)" },
        amount: { type: "number", description: "Signed amount in COP: negative = withdrawal/spend/gift out, positive = deposit/credit in" },
        date: { type: "string", description: "ISO date (YYYY-MM-DD), defaults to today" },
        notes: { type: "string", description: "Notes (optional)" },
      },
      required: ["accountName", "amount"],
    },
  },
  {
    name: "propose_transfer",
    description:
      "Propose moving money between two of the user's savings accounts. Call get_loans first to resolve both account names. Both accounts must exist — savings accounts CANNOT be auto-created. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        fromAccountName: { type: "string", description: "Source savings account name (must exist)" },
        toAccountName: { type: "string", description: "Destination savings account name (must exist)" },
        amount: { type: "number", description: "Transfer amount in COP (positive)" },
        date: { type: "string", description: "ISO date (YYYY-MM-DD), defaults to today" },
        notes: { type: "string", description: "Notes (optional)" },
      },
      required: ["fromAccountName", "toAccountName", "amount"],
    },
  },

  // ── Transaction tools ──
  {
    name: "propose_add_transaction",
    description:
      "Propose adding a single expense/income transaction (bot-captured, e.g. from a bank notification or typed in chat). Signed amount: negative = expense, positive = income. Call get_categories first to guess the best appCategoryName — the category is always editable directly on the resulting card, so never ask a clarifying question about it; an unresolved or omitted category name falls back to a reasonable default. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Signed amount in COP: negative = expense, positive = income" },
        date: { type: "string", description: "ISO date (YYYY-MM-DD), defaults to today" },
        appCategoryName: {
          type: "string",
          description: "Best-guess AppCategory name (optional — call get_categories to pick a real one). Never blocks; editable on the card.",
        },
        wallet: { type: "string", description: "Account/wallet label, e.g. bank name (optional)" },
        note: { type: "string", description: "Merchant or note (optional)" },
      },
      required: ["amount"],
    },
  },

  // ── Undo tool ──
  {
    name: "propose_undo_last",
    description:
      "Propose reversing the last approved conversational write (createInstallment, markPayment, createLoan, recordPayment, createDebtor, createCard). Imports cannot be undone. Emits an action card — does NOT mutate.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];
