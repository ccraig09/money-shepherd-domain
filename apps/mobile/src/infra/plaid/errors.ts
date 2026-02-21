export type PlaidErrorCategory =
  | "not-configured"
  | "not-connected"
  | "token-expired"
  | "network"
  | "unknown";

export type PlaidErrorInfo = {
  category: PlaidErrorCategory;
  message: string;
  cta: string;
};

const MESSAGES: Record<PlaidErrorCategory, { message: string; cta: string }> = {
  "not-configured": {
    message: "Plaid is not configured. Add EXPO_PUBLIC_PLAID_ENV to your .env.",
    cta: "Go to Settings",
  },
  "not-connected": {
    message: "No bank account connected. Link one in Settings to import transactions.",
    cta: "Connect bank",
  },
  "token-expired": {
    message: "Your bank connection needs to be refreshed. Please reconnect.",
    cta: "Reconnect",
  },
  network: {
    message: "Could not reach Plaid. Check your connection and try again.",
    cta: "Retry",
  },
  unknown: {
    message: "Something went wrong syncing your transactions.",
    cta: "Retry",
  },
};

export function makePlaidError(category: PlaidErrorCategory): PlaidErrorInfo {
  return { category, ...MESSAGES[category] };
}

export function classifyPlaidError(err: unknown): PlaidErrorInfo {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  const code = (err as { code?: string })?.code ?? "";

  // Item login revoked / token expired
  if (
    lower.includes("item_login_required") ||
    lower.includes("login_required") ||
    lower.includes("item-login-required")
  ) {
    return { category: "token-expired", ...MESSAGES["token-expired"] };
  }

  // Network / service unavailable
  if (
    code === "unavailable" ||
    lower.includes("network") ||
    lower.includes("offline") ||
    lower.includes("etimedout") ||
    lower.includes("failed to fetch")
  ) {
    return { category: "network", ...MESSAGES.network };
  }

  // Auth or item not found
  if (code === "unauthenticated" || code === "not-found") {
    return { category: "not-connected", ...MESSAGES["not-connected"] };
  }

  return { category: "unknown", ...MESSAGES.unknown };
}
