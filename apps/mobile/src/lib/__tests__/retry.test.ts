import { withRetry } from "../retry";

describe("withRetry", () => {
  it("returns the value on first success", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure then returns on success", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail-1"))
      .mockRejectedValueOnce(new Error("fail-2"))
      .mockResolvedValue("recovered");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error after exhausting retries", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("persistent"));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow("persistent");
    // 1 initial + 2 retries = 3
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry when shouldRetry returns false", async () => {
    const conflictErr = Object.assign(new Error("conflict"), { code: "SYNC_CONFLICT" });
    const fn = jest.fn().mockRejectedValue(conflictErr);

    const shouldRetry = (err: unknown) =>
      (err as any)?.code !== "SYNC_CONFLICT";

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 1, shouldRetry }),
    ).rejects.toThrow("conflict");

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
