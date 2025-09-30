import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EditorPlaceholder } from "@/components/editor";

describe("EditorPlaceholder", () => {
  it("renders the generic redesign message", () => {
    render(<EditorPlaceholder />);

    expect(screen.getByText(/editor redesign in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/building a new translation workspace/i)).toBeInTheDocument();
  });

  it("renders the project name when supplied", () => {
    render(<EditorPlaceholder projectName="Demo Project" />);

    expect(screen.getByText(/for Demo Project/i)).toBeInTheDocument();
  });
});
