import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlaceholderParityBadge } from "./PlaceholderParityBadge";

describe("PlaceholderParityBadge", () => {
  it("labels parity when counts align", () => {
    render(
      <PlaceholderParityBadge
        status="ok"
        counts={{ source: 2, target: 2, missing: 0, extra: 0 }}
      />,
    );

    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("data-placeholder-status", "ok");
    expect(badge).toHaveTextContent(/2\s*src/i);
    expect(badge).toHaveTextContent(/2\s*tgt/i);
    expect(badge).toHaveAccessibleName(/parity ok/i);
  });

  it("surfaces missing placeholder summary", () => {
    render(
      <PlaceholderParityBadge
        status="missing"
        counts={{ source: 3, target: 2, missing: 1, extra: 0 }}
      />,
    );

    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("data-placeholder-status", "missing");
    expect(badge).toHaveAccessibleName(/1 placeholder is missing in target/i);
    expect(badge).toHaveAttribute(
      "title",
      expect.stringContaining("Source 3 / Target 2 (missing 1, extra 0)"),
    );
  });
});
