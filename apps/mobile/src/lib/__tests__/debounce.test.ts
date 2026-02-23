import { debouncedAsync } from "../debounce";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("debouncedAsync", () => {
  it("calls fn once after the delay with the argument", async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const debounced = debouncedAsync(fn, 500);

    debounced("a");
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("resets the timer on rapid calls — only the last fires", async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const debounced = debouncedAsync(fn, 500);

    debounced("a");
    jest.advanceTimersByTime(200);
    debounced("b");
    jest.advanceTimersByTime(200);
    debounced("c");

    // 400ms since last call — not yet
    jest.advanceTimersByTime(400);
    expect(fn).not.toHaveBeenCalled();

    // 500ms since last call — fires with "c"
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("swallows rejections without throwing", () => {
    const fn = jest.fn().mockRejectedValue(new Error("boom"));
    const debounced = debouncedAsync(fn, 100);

    debounced("x");
    // Should not throw
    expect(() => jest.advanceTimersByTime(100)).not.toThrow();
  });
});
