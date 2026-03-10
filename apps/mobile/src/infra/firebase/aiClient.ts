import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebase, ensureAnonAuth } from "./firebaseClient";
import type { AiContextPayload, AnalyzeSpendingResponse, SuggestAllocationsPayload, SuggestAllocationsResponse, CategorizeTransactionsPayload, CategorizeTransactionsResponse } from "./aiTypes";

const functions = getFunctions(getFirebase().app);

/**
 * Calls the analyzeSpending Cloud Function.
 * Sends sanitized spending context, receives envelope suggestions.
 */
export async function callAnalyzeSpending(
  householdId: string,
  context: AiContextPayload,
): Promise<AnalyzeSpendingResponse> {
  await ensureAnonAuth();
  const fn = httpsCallable<
    { householdId: string; context: AiContextPayload },
    AnalyzeSpendingResponse
  >(functions, "analyzeSpending");

  const result = await fn({ householdId, context });
  return result.data;
}

/**
 * Calls the suggestAllocations Cloud Function.
 * Sends available cents + envelope list, receives allocation suggestions.
 */
export async function callSuggestAllocations(
  householdId: string,
  payload: SuggestAllocationsPayload,
): Promise<SuggestAllocationsResponse> {
  await ensureAnonAuth();
  const fn = httpsCallable<
    { householdId: string } & SuggestAllocationsPayload,
    SuggestAllocationsResponse
  >(functions, "suggestAllocations");

  const result = await fn({ householdId, ...payload });
  return result.data;
}

/**
 * Calls the categorizeTransactions Cloud Function.
 * Sends a batch of merchant names + envelope list, receives high/medium confidence mappings.
 */
export async function callCategorizeTransactions(
  householdId: string,
  payload: CategorizeTransactionsPayload,
): Promise<CategorizeTransactionsResponse> {
  await ensureAnonAuth();
  const fn = httpsCallable<
    { householdId: string } & CategorizeTransactionsPayload,
    CategorizeTransactionsResponse
  >(functions, "categorizeTransactions");

  const result = await fn({ householdId, ...payload });
  return result.data;
}
