import { classifySyncError } from "../../infra/remote/syncErrors";

describe("classifySyncError", () => {
  it("classifies permission-denied by code", () => {
    const err: any = new Error("PERMISSION_DENIED");
    err.code = "permission-denied";
    const info = classifySyncError(err);
    expect(info.category).toBe("permission");
    expect(info.message).toContain("not authorized");
  });

  it("classifies permission-denied by message", () => {
    const err = new Error("Missing or insufficient permission-denied");
    const info = classifySyncError(err);
    expect(info.category).toBe("permission");
  });

  it("classifies unauthenticated by code", () => {
    const err: any = new Error("User not signed in");
    err.code = "unauthenticated";
    const info = classifySyncError(err);
    expect(info.category).toBe("auth");
    expect(info.message).toContain("Session expired");
  });

  it("classifies timeout errors", () => {
    const err = new Error("Sync push: timed out after 10000ms");
    const info = classifySyncError(err);
    expect(info.category).toBe("timeout");
    expect(info.message).toContain("timed out");
  });

  it("classifies network unavailable by code", () => {
    const err: any = new Error("service unavailable");
    err.code = "unavailable";
    const info = classifySyncError(err);
    expect(info.category).toBe("network");
    expect(info.message).toContain("No internet");
  });

  it("classifies network errors by message", () => {
    const err = new Error("Failed to fetch");
    const info = classifySyncError(err);
    expect(info.category).toBe("network");
  });

  it("falls back to unknown for unrecognized errors", () => {
    const err = new Error("Something bizarre happened");
    const info = classifySyncError(err);
    expect(info.category).toBe("unknown");
    expect(info.message).toContain("saved locally");
    expect(info.cta).toBe("Retry");
  });

  it("handles null/undefined input", () => {
    expect(classifySyncError(null).category).toBe("unknown");
    expect(classifySyncError(undefined).category).toBe("unknown");
  });
});
