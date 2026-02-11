/**
 * Client-side JWT validation utilities.
 *
 * Validates token structure (three base64url segments) and checks expiry.
 * This is NOT a cryptographic verification — the server handles that.
 * This provides defense-in-depth: expired or malformed tokens are caught
 * client-side before making unnecessary API calls.
 */

interface JwtPayload {
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * Decode a base64url string to a UTF-8 string.
 */
function base64UrlDecode(str: string): string {
  // Replace base64url chars with base64 equivalents
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Pad with '=' to make length a multiple of 4
  const pad = base64.length % 4;
  if (pad) {
    base64 += "=".repeat(4 - pad);
  }
  return atob(base64);
}

/**
 * Parse the payload of a JWT without verifying the signature.
 * Returns null if the token is malformed.
 */
export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Each part must be non-empty
    if (!parts[0] || !parts[1] || !parts[2]) {
      return null;
    }

    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson);

    // Payload must be an object
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      return null;
    }

    return payload as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is well-formed and not expired.
 *
 * @param token - The raw JWT string
 * @param clockSkewSeconds - Tolerance for clock drift (default: 60s)
 * @returns true if the token is a valid JWT structure with a non-expired `exp` claim
 */
export function isTokenValid(token: string, clockSkewSeconds = 60): boolean {
  const payload = parseJwtPayload(token);
  if (!payload) {
    return false;
  }

  // If there's no exp claim, treat as invalid (defense-in-depth)
  if (typeof payload.exp !== "number") {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp > nowSeconds - clockSkewSeconds;
}
