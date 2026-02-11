import { describe, it, expect } from "vitest";
import axios from "axios";
import packageJson from "../../../package.json";

describe("axios prototype pollution DoS (GHSA-43fc-jf86-j433)", () => {
  it("should have axios >= 1.13.5 in package.json to patch prototype pollution", () => {
    const version = packageJson.dependencies["axios"];
    const baseVersion = version.replace(/^[\^~>=<]+/, "");
    const [major, minor, patch] = baseVersion.split(".").map(Number);

    // Must be at least 1.13.5 (the actual fix version)
    const isPatched =
      major > 1 ||
      (major === 1 && minor > 13) ||
      (major === 1 && minor === 13 && patch >= 5);

    expect(isPatched).toBe(true);
  });

  it("should not pollute Object.prototype via mergeConfig with __proto__ key", () => {
    // Save original prototype state
    const originalKeys = Object.getOwnPropertyNames(Object.prototype);

    // Attempt the exploit: mergeConfig with __proto__ payload
    try {
      // @ts-expect-error - intentionally testing malicious input
      axios.create({
        headers: {
              "__proto__": { polluted: "yes" },
        },
      });
    } catch {
      // It's fine if it throws — that also means it's not polluting
    }

    // Verify Object.prototype was not polluted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((Object.prototype as any).polluted).toBeUndefined();

    // Verify no new properties were added to Object.prototype
    const currentKeys = Object.getOwnPropertyNames(Object.prototype);
    expect(currentKeys).toEqual(originalKeys);
  });

  it("should have installed axios version that is patched", () => {
    const installedVersion = axios.VERSION || "";
    if (installedVersion) {
      const [major, minor, patch] = installedVersion.split(".").map(Number);
      const isPatched =
        major > 1 ||
        (major === 1 && minor > 13) ||
        (major === 1 && minor === 13 && patch >= 5);
      expect(isPatched).toBe(true);
    }
  });
});
