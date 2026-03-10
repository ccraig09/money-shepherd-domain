export type InsightSeverity = "info" | "warning" | "success";

export type InsightType =
  | "overspent-envelope"
  | "nearly-depleted"
  | "unassigned-transactions"
  | "idle-funds"
  | "debt-milestone"
  | "positive-net"
  | "ai-tip"
  | "unusual-charge"
  | "spending-spike";

export type Insight = {
  type: InsightType;
  message: string;
  severity: InsightSeverity;
  envelopeId?: string;
};
