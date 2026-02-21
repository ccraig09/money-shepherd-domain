import { classifyPlaidError } from "../errors";

describe("classifyPlaidError", () => {
  it("classifies ITEM_LOGIN_REQUIRED as token-expired", () => {
    const err = new Error("ITEM_LOGIN_REQUIRED: The login details of this item have changed.");
    expect(classifyPlaidError(err).category).toBe("token-expired");
  });

  it("classifies login_required (lowercase) as token-expired", () => {
    const err = new Error("item-login-required");
    expect(classifyPlaidError(err).category).toBe("token-expired");
  });

  it("classifies unavailable code as network error", () => {
    const err = Object.assign(new Error("Service unavailable"), { code: "unavailable" });
    expect(classifyPlaidError(err).category).toBe("network");
  });

  it("classifies 'network' in message as network error", () => {
    const err = new Error("A network error occurred.");
    expect(classifyPlaidError(err).category).toBe("network");
  });

  it("classifies 'failed to fetch' as network error", () => {
    const err = new Error("Failed to fetch");
    expect(classifyPlaidError(err).category).toBe("network");
  });

  it("classifies unauthenticated code as not-connected", () => {
    const err = Object.assign(new Error("Must be signed in."), { code: "unauthenticated" });
    expect(classifyPlaidError(err).category).toBe("not-connected");
  });

  it("classifies not-found code as not-connected", () => {
    const err = Object.assign(new Error("Item not found."), { code: "not-found" });
    expect(classifyPlaidError(err).category).toBe("not-connected");
  });

  it("classifies an unknown error as unknown", () => {
    const err = new Error("Something exploded.");
    expect(classifyPlaidError(err).category).toBe("unknown");
  });

  it("classifies a non-Error value as unknown", () => {
    expect(classifyPlaidError("raw string error").category).toBe("unknown");
  });

  it("returns a non-empty message and cta for every category", () => {
    const categories = [
      new Error("ITEM_LOGIN_REQUIRED"),
      Object.assign(new Error("unavailable"), { code: "unavailable" }),
      Object.assign(new Error("unauthenticated"), { code: "unauthenticated" }),
      new Error("network error"),
      new Error("something unknown"),
    ];
    for (const err of categories) {
      const result = classifyPlaidError(err);
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.cta.length).toBeGreaterThan(0);
    }
  });
});
