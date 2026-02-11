import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("lodash prototype pollution (GHSA-xxjr-mmjv-4gpg)", () => {
  it("should have lodash >= 4.17.22 to patch prototype pollution in _.unset and _.omit", () => {
    // Get the installed lodash version from node_modules
    const output = execSync("node -e \"console.log(require('lodash/package.json').version)\"", {
      encoding: "utf-8",
      cwd: process.cwd(),
    }).trim();

    const [major, minor, patch] = output.split(".").map(Number);

    // Must be at least 4.17.22 (the fix for GHSA-xxjr-mmjv-4gpg)
    const isPatched =
      major > 4 ||
      (major === 4 && minor > 17) ||
      (major === 4 && minor === 17 && patch >= 22);

    expect(isPatched).toBe(true);
    expect(output).not.toBe("4.17.21"); // Known vulnerable version
  });

  it("should not be vulnerable to prototype pollution via _.unset", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const _ = require("lodash");
    const obj = {};

    // Attempt prototype pollution via _.unset — this was the attack vector
    _.unset(obj, "__proto__.polluted");

    // Verify Object.prototype was not polluted
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("should not allow npm audit to flag lodash prototype pollution", () => {
    let output: string;
    try {
      output = execSync("npm audit --json 2>&1", {
        encoding: "utf-8",
        cwd: process.cwd(),
      });
    } catch (e: unknown) {
      // npm audit exits non-zero when vulnerabilities exist (even unrelated ones)
      output = (e as { stdout?: string }).stdout || String(e);
    }

    // Parse the audit output and check no lodash vulnerabilities exist
    try {
      const audit = JSON.parse(output);
      const vulnerabilities = audit.vulnerabilities || {};
      const lodashVuln = vulnerabilities["lodash"];

      if (lodashVuln) {
        // If lodash appears, it should not have prototype pollution advisory
        const vias = Array.isArray(lodashVuln.via) ? lodashVuln.via : [];
        const hasProtoPollution = vias.some(
          (v: { url?: string }) =>
            typeof v === "object" && v.url?.includes("GHSA-xxjr-mmjv-4gpg")
        );
        expect(hasProtoPollution).toBe(false);
      }
    } catch {
      // If npm audit output isn't valid JSON, check raw text
      expect(output).not.toContain("GHSA-xxjr-mmjv-4gpg");
    }
  });
});
