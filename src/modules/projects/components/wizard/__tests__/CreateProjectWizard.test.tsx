import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateProjectWizard } from "@/modules/projects/components/wizard/CreateProjectWizard";

vi.mock("@/shared/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("CreateProjectWizard placeholder", () => {
  it("renders TODO message", () => {
    render(<CreateProjectWizard open={true} onOpenChange={() => {}} />);
    expect(screen.getByText(/TODO: Rebuild the legacy project wizard/i)).toBeInTheDocument();
  });
});
