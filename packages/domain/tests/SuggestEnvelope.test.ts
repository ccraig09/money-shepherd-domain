import { suggestEnvelope } from "../src";
import type { AssignmentRule, EnvelopeSuggestion } from "../src";

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
});
