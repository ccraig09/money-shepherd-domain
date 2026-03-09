import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebase } from "./firebaseClient";
import type { AiContextPayload, AnalyzeSpendingResponse } from "./aiTypes";

const functions = getFunctions(getFirebase().app);

/**
 * Calls the analyzeSpending Cloud Function.
 * Sends sanitized spending context, receives envelope suggestions.
 */
export async function callAnalyzeSpending(
  householdId: string,
  context: AiContextPayload,
): Promise<AnalyzeSpendingResponse> {
  const fn = httpsCallable<
    { householdId: string; context: AiContextPayload },
    AnalyzeSpendingResponse
  >(functions, "analyzeSpending");

  const result = await fn({ householdId, context });
  return result.data;
}
