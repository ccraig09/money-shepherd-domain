// Simple, local-only ID helper for MVP.
// Later: replace tx IDs with Plaid transaction IDs.
export function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
