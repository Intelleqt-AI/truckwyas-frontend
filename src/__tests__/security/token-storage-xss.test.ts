import { describe, it, expect, beforeEach } from "vitest";
import { tokenStorage } from "@/lib/tokenStorage";

describe("Auth token storage XSS exfiltration prevention", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("should store tokens in sessionStorage, not localStorage", () => {
    tokenStorage.setToken("test-access-token");
    tokenStorage.setUser({ username: "testuser" });

    // Token must be in sessionStorage
    expect(sessionStorage.getItem("access")).toBe("test-access-token");
    expect(sessionStorage.getItem("user")).toBe(
      JSON.stringify({ username: "testuser" })
    );

    // Token must NOT be in localStorage (XSS exfiltration vector)
    expect(localStorage.getItem("access")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("should retrieve tokens from sessionStorage", () => {
    sessionStorage.setItem("access", "my-token");
    sessionStorage.setItem("user", JSON.stringify({ id: 1 }));

    expect(tokenStorage.getToken()).toBe("my-token");
    expect(tokenStorage.getUser()).toEqual({ id: 1 });
  });

  it("should not read tokens from localStorage even if present", () => {
    // Simulate tokens left in localStorage from old code
    localStorage.setItem("access", "old-insecure-token");
    localStorage.setItem("user", JSON.stringify({ username: "old" }));

    // tokenStorage should NOT find these
    expect(tokenStorage.getToken()).toBeNull();
    expect(tokenStorage.getUser()).toBeNull();
  });

  it("should clear all auth data from sessionStorage on clearAll", () => {
    tokenStorage.setToken("token");
    tokenStorage.setRefreshToken("refresh");
    tokenStorage.setUser({ username: "test" });

    tokenStorage.clearAll();

    expect(tokenStorage.getToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect(tokenStorage.getUser()).toBeNull();
  });

  it("should handle malformed user JSON gracefully", () => {
    sessionStorage.setItem("user", "not-valid-json");
    expect(tokenStorage.getUser()).toBeNull();
  });

  it("should not expose tokens via localStorage API (simulated XSS exfiltration)", () => {
    // Simulate a full login flow writing token
    tokenStorage.setToken("secret-auth-token");

    // An XSS attacker typically does: localStorage.getItem('access')
    // This must return null — tokens are in sessionStorage only
    const stolenToken = localStorage.getItem("access");
    expect(stolenToken).toBeNull();
  });
});
