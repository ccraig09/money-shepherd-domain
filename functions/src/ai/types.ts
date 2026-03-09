/**
 * Shared types for AI Cloud Functions.
 * These mirror the domain AiContext type but are self-contained
 * so Cloud Functions don't depend on the domain package.
 */

// ── Request types (client → function) ──────────────────────

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

export interface AnalyzeSpendingRequest {
  householdId: string;
  context: AiContextPayload;
}

export interface EnvelopeSuggestion {
  name: string;
  goalCents: number;
  type: "giving" | "spending" | "savings" | "debt";
  reason: string;
}

export interface AnalyzeSpendingResponse {
  suggestions: EnvelopeSuggestion[];
  /** Present when spending is ≥75% of the monthly budget cap */
  warning?: "budget_warning";
}

export interface SuggestAllocationsRequest {
  householdId: string;
  availableCents: number;
  envelopes: Array<{
    id: string;
    name: string;
    balanceCents: number;
    goalCents?: number;
    type?: string;
  }>;
}

export interface AllocationSuggestion {
  envelopeId: string;
  amountCents: number;
  reason: string;
}

export interface SuggestAllocationsResponse {
  allocations: AllocationSuggestion[];
}

export interface CategorizeTransactionsRequest {
  householdId: string;
  merchants: string[];
  envelopes: Array<{
    id: string;
    name: string;
    type?: string;
  }>;
}

export interface MerchantCategorization {
  merchant: string;
  envelopeId: string;
  confidence: "high" | "medium" | "low";
}

export interface CategorizeTransactionsResponse {
  categorizations: MerchantCategorization[];
}

// ── Usage tracking ─────────────────────────────────────────

export interface AiUsageRecord {
  functionName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
  calledAt: string; // ISO
}
