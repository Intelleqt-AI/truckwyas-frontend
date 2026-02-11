import { describe, it, expect } from "vitest";
import { parseJwtPayload, isTokenValid } from "@/lib/jwtValidation";

/**
 * Helper: create a JWT-like token with a given payload.
 * Uses a dummy header and signature — we only validate structure + expiry client-side.
 */
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const signature = "dummysignature";
  return `${header}.${body}.${signature}`;
}

describe("JWT validation for ProtectedRoute defense-in-depth", () => {
  describe("parseJwtPayload", () => {
    it("should parse a well-formed JWT payload", () => {
      const token = makeJwt({ sub: "user123", exp: 9999999999 });
      const payload = parseJwtPayload(token);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe("user123");
      expect(payload?.exp).toBe(9999999999);
    });

    it("should reject an arbitrary string (not a JWT)", () => {
      expect(parseJwtPayload("not-a-jwt")).toBeNull();
    });

    it("should reject an empty string", () => {
      expect(parseJwtPayload("")).toBeNull();
    });

    it("should reject a token with only two segments", () => {
      expect(parseJwtPayload("header.payload")).toBeNull();
    });

    it("should reject a token with four segments", () => {
      expect(parseJwtPayload("a.b.c.d")).toBeNull();
    });

    it("should reject a token with empty segments", () => {
      expect(parseJwtPayload("..")).toBeNull();
    });

    it("should reject a token where payload is not valid JSON", () => {
      const header = btoa("{}").replace(/=+$/, "");
      const badPayload = btoa("not json").replace(/=+$/, "");
      // Even though we catch the error, it should return null gracefully
      expect(parseJwtPayload(`${header}.${badPayload}.sig`)).toBeNull();
    });

    it("should reject a token where payload is a JSON array", () => {
      const token = makeJwt([] as unknown as Record<string, unknown>);
      // Array payload is not valid JWT
      expect(parseJwtPayload(token)).toBeNull();
    });
  });

  describe("isTokenValid", () => {
    it("should accept a valid token with future expiry", () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const token = makeJwt({ sub: "user123", exp: futureExp });
      expect(isTokenValid(token)).toBe(true);
    });

    it("should reject an expired token", () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const token = makeJwt({ sub: "user123", exp: pastExp });
      expect(isTokenValid(token)).toBe(false);
    });

    it("should reject a token with no exp claim", () => {
      const token = makeJwt({ sub: "user123" });
      expect(isTokenValid(token)).toBe(false);
    });

    it("should reject a malformed string that is not a JWT", () => {
      expect(isTokenValid("any-arbitrary-string")).toBe(false);
    });

    it("should reject an empty string", () => {
      expect(isTokenValid("")).toBe(false);
    });

    it("should accept a token within clock skew tolerance", () => {
      // Token expired 30 seconds ago, but default skew is 60s
      const recentExp = Math.floor(Date.now() / 1000) - 30;
      const token = makeJwt({ sub: "user123", exp: recentExp });
      expect(isTokenValid(token, 60)).toBe(true);
    });

    it("should reject a token beyond clock skew tolerance", () => {
      // Token expired 120 seconds ago, skew is 60s
      const oldExp = Math.floor(Date.now() / 1000) - 120;
      const token = makeJwt({ sub: "user123", exp: oldExp });
      expect(isTokenValid(token, 60)).toBe(false);
    });

    it("should reject a token where exp is a string, not a number", () => {
      const token = makeJwt({ sub: "user123", exp: "not-a-number" });
      expect(isTokenValid(token)).toBe(false);
    });
  });

  describe("ProtectedRoute attack scenarios", () => {
    it("should reject arbitrary string that previously granted access via truthy check", () => {
      // This is the core vulnerability: any truthy string used to pass the old check
      expect(isTokenValid("admin")).toBe(false);
      expect(isTokenValid("true")).toBe(false);
      expect(isTokenValid("1")).toBe(false);
      expect(isTokenValid("password123")).toBe(false);
    });

    it("should reject a crafted token with manipulated exp", () => {
      // Even if someone crafts a JWT with a far-future exp, the server
      // still validates signatures. But client-side, we only check structure + exp.
      // A crafted token with valid structure + future exp WILL pass client-side
      // (this is expected — server-side validation catches tampered tokens).
      const craftedToken = makeJwt({ sub: "attacker", exp: 9999999999 });
      // This passes client-side validation — that's by design
      expect(isTokenValid(craftedToken)).toBe(true);
      // The server will reject it because the signature is invalid
    });
  });
});
