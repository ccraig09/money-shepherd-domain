/**
 * Client-side mirror of AI Cloud Function request/response types.
 * Kept in sync with functions/src/ai/types.ts — do not import from there
 * (functions/ is not in the mobile tsconfig paths).
 */

export interface AiContextPayload {
  totalIncomeCents: number;
  totalExpensesCents: number;
  availableToAssignCents: number;
  envelopes: Array<{
    name: string;
    balanceCents: number;
    goalCents?: number;
    type?: string;
  }>;
  topMerchants: Array<{
    normalizedName: string;
    totalCents: number;
    count: number;
  }>;
  accountSummary: Array<{
    type: string;
    balanceCents: number;
    count: number;
  }>;
  transactionCount: number;
  periodStartDate: string;
  periodEndDate: string;
}

export interface EnvelopeSuggestion {
  name: string;
  goalCents: number;
  type: "giving" | "spending" | "savings" | "debt";
  reason: string;
}

export interface AnalyzeSpendingResponse {
  suggestions: EnvelopeSuggestion[];
  /** Present when AI usage is ≥75% of the monthly budget cap */
  warning?: "budget_warning";
}
