import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SegmentToken } from "@/lib/jliff";
import { TokenLine } from "./TokenLine";

describe("TokenLine", () => {
  const sampleTokens: SegmentToken[] = [
    { kind: "text", value: "Hello " },
    { kind: "ph", value: "{{ph:ph1}}", placeholderId: "ph1" },
  ];

  it("renders text and placeholder tokens with accessible controls", async () => {
    const onPlaceholderClick = vi.fn();
    const user = userEvent.setup();

    render(<TokenLine tokens={sampleTokens} direction="source" onPlaceholderClick={onPlaceholderClick} />);

    expect(screen.getByText("Hello", { exact: false })).toBeInTheDocument();

    const chip = screen.getByRole("button", { name: /placeholder \{\{ph:ph1\}\}/i });
    expect(chip).toHaveAttribute("data-ph", "{{ph:ph1}}");
    expect(chip).toHaveAttribute("data-ph-id", "ph1");
    expect(chip).not.toBeDisabled();

    await user.click(chip);
    expect(onPlaceholderClick).toHaveBeenCalledWith(sampleTokens[1]);
  });

  it("disables placeholder controls when no handler is provided", () => {
    render(<TokenLine tokens={sampleTokens} />);

    const chip = screen.getByRole("button", { name: /placeholder \{\{ph:ph1\}\}/i });
    expect(chip).toBeDisabled();
  });

  it("shows an empty state when no tokens are present", () => {
    render(<TokenLine tokens={[]} />);

    expect(screen.getByText("(empty)")).toBeInTheDocument();
  });
});
