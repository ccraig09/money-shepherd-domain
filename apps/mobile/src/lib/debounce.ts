/**
 * Trailing-edge async debounce. Each call resets the timer;
 * when the timer fires, `fn` is invoked with the most recent argument.
 */
export function debouncedAsync<T>(
  fn: (arg: T) => Promise<void>,
  delayMs: number,
): (arg: T) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (arg: T) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(arg).catch(() => {
        /* caller handles errors via the callback */
      });
    }, delayMs);
  };
}
