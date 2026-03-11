import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebase, ensureAnonAuth } from "./firebaseClient";
import type { AiContextPayload, AnalyzeSpendingResponse, SuggestAllocationsPayload, SuggestAllocationsResponse, CategorizeTransactionsPayload, CategorizeTransactionsResponse, MonthlyReviewResponse, ChatMessageEntry, ChatMessageResponse } from "./aiTypes";

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

/**
 * Calls the monthlyReview Cloud Function.
 * Sends current and previous month contexts, receives review with highlights and adjustments.
 */
export async function callMonthlyReview(
  householdId: string,
  currentMonth: AiContextPayload,
  previousMonth: AiContextPayload,
): Promise<MonthlyReviewResponse> {
  await ensureAnonAuth();
  const fn = httpsCallable<
    { householdId: string; currentMonth: AiContextPayload; previousMonth: AiContextPayload },
    MonthlyReviewResponse
  >(functions, "monthlyReview");

  const result = await fn({ householdId, currentMonth, previousMonth });
  return result.data;
}

/**
 * Calls the chatMessage Cloud Function.
 * Sends multi-turn conversation + budget context, receives natural-language reply.
 */
export async function callChatMessage(
  householdId: string,
  messages: ChatMessageEntry[],
  context: AiContextPayload,
): Promise<ChatMessageResponse> {
  await ensureAnonAuth();
  const fn = httpsCallable<
    { householdId: string; messages: ChatMessageEntry[]; context: AiContextPayload },
    ChatMessageResponse
  >(functions, "chatMessage");

  const result = await fn({ householdId, messages, context });
  return result.data;
}
