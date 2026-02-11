import { describe, it, expect } from "vitest";
import packageJson from "../../../package.json";

describe("react-router-dom XSS via Open Redirects (GHSA-2w69-qvjg-hvjx)", () => {
  it("should have react-router-dom >= 6.30.3 to patch open redirect XSS", () => {
    const version = packageJson.dependencies["react-router-dom"];
    // The semver range should allow >= 6.30.3
    // Strip any semver range prefix (^, ~, >=, etc.) to get the base version
    const baseVersion = version.replace(/^[\^~>=<]+/, "");
    const [major, minor, patch] = baseVersion.split(".").map(Number);

    // Must be at least 6.30.3
    expect(major).toBeGreaterThanOrEqual(6);
    if (major === 6) {
      expect(minor).toBeGreaterThanOrEqual(30);
      if (minor === 30) {
        expect(patch).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("should not use a vulnerable react-router-dom version (< 6.30.3)", () => {
    // Verify the installed version from node_modules
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const installedPkg = require("react-router-dom/package.json");
    const [major, minor, patch] = installedPkg.version.split(".").map(Number);

    const isPatched =
      major > 6 ||
      (major === 6 && minor > 30) ||
      (major === 6 && minor === 30 && patch >= 3);

    expect(isPatched).toBe(true);
  });
});
