/**
 * Tiny dev logger.
 *
 * Mental model:
 * - Domain/Engine = important events (actions + recompute summaries)
 * - UI = no noisy logs
 * - In prod: this becomes a no-op unless you later wire Sentry.
 */
const enabled = __DEV__ === true;

type Payload = Record<string, unknown>;

function format(tag: string, payload?: Payload) {
  if (!payload) return [`[MoneyShepherd] ${tag}`];
  return [`[MoneyShepherd] ${tag}`, payload];
}

export function log(tag: string, payload?: Payload) {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.log(...format(tag, payload));
}

export function warn(tag: string, payload?: Payload) {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.warn(...format(tag, payload));
}

export function error(tag: string, payload?: Payload) {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.error(...format(tag, payload));
}
