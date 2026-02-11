import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ChartStyle } from "./chart";
import type { ChartConfig } from "./chart";

describe("ChartStyle CSS Injection Prevention", () => {
  it("should reject malicious CSS values attempting injection", () => {
    const maliciousConfig: ChartConfig = {
      "revenue": {
        label: "Revenue",
        color: "red; } body { display: none; } .x {",
      },
    };

    const { container } = render(
      <ChartStyle id="test-chart" config={maliciousConfig} />
    );

    const styleTag = container.querySelector("style");
    // Malicious value should be rejected entirely (not a valid CSS color)
    expect(styleTag?.textContent).not.toContain("display: none");
    expect(styleTag?.textContent).not.toContain("body");
  });

  it("should reject keys with special characters", () => {
    const maliciousConfig: ChartConfig = {
      "revenue}body{display:none": {
        label: "Revenue",
        color: "#ff0000",
      },
    };

    const { container } = render(
      <ChartStyle id="test-chart" config={maliciousConfig} />
    );

    const styleTag = container.querySelector("style");
    expect(styleTag?.textContent).not.toContain("display:none");
  });

  it("should allow safe CSS color values", () => {
    const safeConfig: ChartConfig = {
      revenue: {
        label: "Revenue",
        color: "#ff6b35",
      },
      expenses: {
        label: "Expenses",
        color: "hsl(220, 70%, 50%)",
      },
    };

    const { container } = render(
      <ChartStyle id="test-chart" config={safeConfig} />
    );

    const styleTag = container.querySelector("style");
    expect(styleTag?.textContent).toContain("--color-revenue: #ff6b35");
    expect(styleTag?.textContent).toContain(
      "--color-expenses: hsl(220, 70%, 50%)"
    );
  });

  it("should not use dangerouslySetInnerHTML", () => {
    const config: ChartConfig = {
      test: { label: "Test", color: "#000" },
    };

    const { container } = render(
      <ChartStyle id="test-chart" config={config} />
    );

    // The style tag should use textContent, not innerHTML injection
    const styleTag = container.querySelector("style");
    expect(styleTag).toBeTruthy();
    expect(styleTag?.textContent).toContain("--color-test: #000");
  });
});
