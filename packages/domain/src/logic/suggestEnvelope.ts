import { normalizePayee } from "./normalizePayee";
import type { RecurringPattern } from "./detectRecurring";

export type AssignmentRule = {
  id: string;
  pattern: string;
  matchType: "contains" | "exact";
  envelopeId: string;
  priority: number;
};

export type EnvelopeSuggestion = {
  envelopeId: string;
  confidence: "high" | "medium";
  source: "rule" | "payee" | "recurring";
};

type SuggestInput = {
  description: string;
  payeeMappings: Record<string, string>;
  rules: AssignmentRule[];
  recurringPatterns?: RecurringPattern[];
};

export function suggestEnvelope(input: SuggestInput): EnvelopeSuggestion | null {
  const normalized = normalizePayee(input.description);
  if (!normalized) return null;

  const ruleMatch = matchByRules(normalized, input.rules);
  if (ruleMatch) return ruleMatch;

  const recurringMatch = matchByRecurring(normalized, input.recurringPatterns ?? []);
  if (recurringMatch) return recurringMatch;

  return matchByPayee(normalized, input.payeeMappings);
}

function matchByRules(
  normalized: string,
  rules: AssignmentRule[],
): EnvelopeSuggestion | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    if (ruleMatches(normalized, rule)) {
      return { envelopeId: rule.envelopeId, confidence: "high", source: "rule" };
    }
  }

  return null;
}

function ruleMatches(normalized: string, rule: AssignmentRule): boolean {
  const pattern = rule.pattern.toLowerCase();

  if (rule.matchType === "exact") return normalized === pattern;
  return normalized.includes(pattern);
}

function matchByRecurring(
  normalized: string,
  patterns: RecurringPattern[],
): EnvelopeSuggestion | null {
  const match = patterns.find((p) => p.normalizedPayee === normalized);
  if (!match) return null;

  return { envelopeId: match.envelopeId, confidence: "high", source: "recurring" };
}

function matchByPayee(
  normalized: string,
  payeeMappings: Record<string, string>,
): EnvelopeSuggestion | null {
  if (!Object.hasOwn(payeeMappings, normalized)) return null;

  return {
    envelopeId: payeeMappings[normalized],
    confidence: "medium",
    source: "payee",
  };
}
