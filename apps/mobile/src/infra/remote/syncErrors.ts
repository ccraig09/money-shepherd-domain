export type SyncErrorCategory =
  | "permission"
  | "auth"
  | "network"
  | "timeout"
  | "unknown";

export type SyncErrorInfo = {
  category: SyncErrorCategory;
  message: string;
  cta: string;
};

const MESSAGES: Record<SyncErrorCategory, { message: string; cta: string }> = {
  permission: {
    message: "Sync not authorized. Check your account.",
    cta: "Go to Settings",
  },
  auth: {
    message: "Session expired. Reconnecting…",
    cta: "Retry",
  },
  network: {
    message: "No internet. Changes saved locally.",
    cta: "Retry",
  },
  timeout: {
    message: "Sync timed out. Changes saved locally.",
    cta: "Retry",
  },
  unknown: {
    message: "Sync failed. Changes saved locally.",
    cta: "Retry",
  },
};

export function classifySyncError(err: unknown): SyncErrorInfo {
  if (err == null) {
    return { category: "unknown", ...MESSAGES.unknown };
  }

  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  const code = (err as { code?: string })?.code ?? "";

  // Firebase permission denied
  if (code === "permission-denied" || lower.includes("permission-denied") || lower.includes("permission_denied")) {
    return { category: "permission", ...MESSAGES.permission };
  }

  // Firebase auth expired / unauthenticated
  if (code === "unauthenticated" || lower.includes("unauthenticated") || lower.includes("session expired")) {
    return { category: "auth", ...MESSAGES.auth };
  }

  // Timeout (from our withTimeout wrapper)
  if (lower.includes("timed out")) {
    return { category: "timeout", ...MESSAGES.timeout };
  }

  // Network / connectivity
  if (
    code === "unavailable" ||
    lower.includes("network") ||
    lower.includes("offline") ||
    lower.includes("failed to fetch") ||
    lower.includes("no internet")
  ) {
    return { category: "network", ...MESSAGES.network };
  }

  return { category: "unknown", ...MESSAGES.unknown };
}
