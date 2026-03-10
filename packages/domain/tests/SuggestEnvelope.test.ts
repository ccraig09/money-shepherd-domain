import { suggestEnvelope } from "../src";
import type { AssignmentRule, EnvelopeSuggestion, RecurringPattern } from "../src";

const payeeMappings: Record<string, string> = {
  walmart: "env-groceries",
  starbucks: "env-dining",
};

describe("suggestEnvelope", () => {
  describe("payee memorization fallback", () => {
    it("suggests envelope from payeeMappings when payee matches", () => {
      const result = suggestEnvelope({
        description: "WALMART #1234",
        payeeMappings,
        rules: [],
      });

      expect(result).toEqual({
        envelopeId: "env-groceries",
        confidence: "medium",
        source: "payee",
      });
    });

    it("returns null when no payee match", () => {
      const result = suggestEnvelope({
        description: "UNKNOWN MERCHANT",
        payeeMappings,
        rules: [],
      });

      expect(result).toBeNull();
    });

    it("returns null when description is empty", () => {
      const result = suggestEnvelope({
        description: "",
        payeeMappings,
        rules: [],
      });

      expect(result).toBeNull();
    });

    it("returns null when payeeMappings is empty", () => {
      const result = suggestEnvelope({
        description: "WALMART #1234",
        payeeMappings: {},
        rules: [],
      });

      expect(result).toBeNull();
    });
  });

  describe("assignment rules", () => {
    const containsRule: AssignmentRule = {
      id: "rule-1",
      pattern: "walmart",
      matchType: "contains",
      envelopeId: "env-food",
      priority: 1,
    };

    const exactRule: AssignmentRule = {
      id: "rule-2",
      pattern: "starbucks",
      matchType: "exact",
      envelopeId: "env-coffee",
      priority: 1,
    };

    it("matches a 'contains' rule against normalized description", () => {
      const result = suggestEnvelope({
        description: "WALMART SUPERCENTER #5678",
        payeeMappings: {},
        rules: [containsRule],
      });

      expect(result).toEqual({
        envelopeId: "env-food",
        confidence: "high",
        source: "rule",
      });
    });

    it("matches an 'exact' rule against normalized description", () => {
      const result = suggestEnvelope({
        description: "STARBUCKS",
        payeeMappings: {},
        rules: [exactRule],
      });

      expect(result).toEqual({
        envelopeId: "env-coffee",
        confidence: "high",
        source: "rule",
      });
    });

    it("does not match 'exact' rule on partial match", () => {
      const result = suggestEnvelope({
        description: "STARBUCKS RESERVE",
        payeeMappings: {},
        rules: [exactRule],
      });

      expect(result).toBeNull();
    });

    it("rules take priority over payee memorization", () => {
      const result = suggestEnvelope({
        description: "WALMART #1234",
        payeeMappings, // would map to env-groceries
        rules: [containsRule], // maps to env-food
      });

      expect(result?.envelopeId).toBe("env-food");
      expect(result?.source).toBe("rule");
    });

    it("evaluates rules in priority order (lower number = higher priority)", () => {
      const lowPriority: AssignmentRule = {
        id: "rule-lo",
        pattern: "walmart",
        matchType: "contains",
        envelopeId: "env-general",
        priority: 10,
      };
      const highPriority: AssignmentRule = {
        id: "rule-hi",
        pattern: "walmart",
        matchType: "contains",
        envelopeId: "env-food",
        priority: 1,
      };

      const result = suggestEnvelope({
        description: "WALMART",
        payeeMappings: {},
        rules: [lowPriority, highPriority],
      });

      expect(result?.envelopeId).toBe("env-food");
    });

    it("falls back to payee mapping when no rule matches", () => {
      const result = suggestEnvelope({
        description: "STARBUCKS NEW YORK NY",
        payeeMappings,
        rules: [containsRule], // only matches walmart
      });

      expect(result?.envelopeId).toBe("env-dining");
      expect(result?.source).toBe("payee");
    });
  });

  describe("recurring patterns", () => {
    const recurringNetflix: RecurringPattern = {
      normalizedPayee: "netflix",
      envelopeId: "env-subs",
      interval: "monthly",
    };

    it("suggests from recurring pattern with high confidence", () => {
      const result = suggestEnvelope({
        description: "NETFLIX",
        payeeMappings: {},
        rules: [],
        recurringPatterns: [recurringNetflix],
      });

      expect(result).toEqual({
        envelopeId: "env-subs",
        confidence: "high",
        source: "recurring",
      });
    });

    it("rules take priority over recurring patterns", () => {
      const rule: AssignmentRule = {
        id: "rule-1",
        pattern: "netflix",
        matchType: "contains",
        envelopeId: "env-entertainment",
        priority: 1,
      };

      const result = suggestEnvelope({
        description: "NETFLIX",
        payeeMappings: {},
        rules: [rule],
        recurringPatterns: [recurringNetflix],
      });

      expect(result?.envelopeId).toBe("env-entertainment");
      expect(result?.source).toBe("rule");
    });

    it("recurring takes priority over payee memorization", () => {
      const result = suggestEnvelope({
        description: "NETFLIX",
        payeeMappings: { netflix: "env-dining" },
        rules: [],
        recurringPatterns: [recurringNetflix],
      });

      expect(result?.envelopeId).toBe("env-subs");
      expect(result?.source).toBe("recurring");
    });

    it("falls back to payee when no recurring match", () => {
      const result = suggestEnvelope({
        description: "WALMART #1234",
        payeeMappings,
        rules: [],
        recurringPatterns: [recurringNetflix],
      });

      expect(result?.envelopeId).toBe("env-groceries");
      expect(result?.source).toBe("payee");
    });
  });

  describe("AI mappings", () => {
    const aiMappings: Record<string, string> = {
      target: "env-shopping",
      "whole foods": "env-groceries",
    };

    it("suggests envelope from AI mappings with medium confidence", () => {
      const result = suggestEnvelope({
        description: "TARGET #0123",
        payeeMappings: {},
        rules: [],
        aiMappings,
      });

      expect(result).toEqual({
        envelopeId: "env-shopping",
        confidence: "medium",
        source: "ai",
      });
    });

    it("rules take priority over AI mappings", () => {
      const rule: AssignmentRule = {
        id: "rule-1",
        pattern: "target",
        matchType: "contains",
        envelopeId: "env-general",
        priority: 1,
      };

      const result = suggestEnvelope({
        description: "TARGET",
        payeeMappings: {},
        rules: [rule],
        aiMappings,
      });

      expect(result?.envelopeId).toBe("env-general");
      expect(result?.source).toBe("rule");
    });

    it("AI takes priority over recurring patterns", () => {
      const recurringTarget: RecurringPattern = {
        normalizedPayee: "target",
        envelopeId: "env-recurring",
        interval: "monthly",
      };

      const result = suggestEnvelope({
        description: "TARGET",
        payeeMappings: {},
        rules: [],
        recurringPatterns: [recurringTarget],
        aiMappings,
      });

      expect(result?.envelopeId).toBe("env-shopping");
      expect(result?.source).toBe("ai");
    });

    it("AI takes priority over payee memorization", () => {
      const result = suggestEnvelope({
        description: "TARGET",
        payeeMappings: { target: "env-old" },
        rules: [],
        aiMappings,
      });

      expect(result?.envelopeId).toBe("env-shopping");
      expect(result?.source).toBe("ai");
    });

    it("falls back through AI to payee when no AI match", () => {
      const result = suggestEnvelope({
        description: "STARBUCKS",
        payeeMappings: { starbucks: "env-dining" },
        rules: [],
        aiMappings,
      });

      expect(result?.envelopeId).toBe("env-dining");
      expect(result?.source).toBe("payee");
    });

    it("returns null when no source matches", () => {
      const result = suggestEnvelope({
        description: "UNKNOWN STORE",
        payeeMappings: {},
        rules: [],
        aiMappings,
      });

      expect(result).toBeNull();
    });
  });
});
