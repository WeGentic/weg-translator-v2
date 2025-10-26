import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  PASSWORD_RULES,
  type PasswordRequirementStatus,
} from "@/modules/auth/utils/passwordPolicy";
import {
  PasswordRequirementsPanel,
  type PasswordRequirementsPanelProps,
} from "@/modules/auth/components/forms/PasswordRequirementsPanel";

const renderPanel = (overrideProps: Partial<PasswordRequirementsPanelProps> = {}) => {
  const requirements: PasswordRequirementStatus[] = PASSWORD_RULES.map((rule, index) => ({
    id: rule.id,
    label: rule.label,
    description: rule.description,
    failureMessage: rule.failureMessage,
    met: index % 2 === 0,
  }));

  const props: PasswordRequirementsPanelProps = {
    requirements,
    isVisible: true,
    summaryId: "password-panel-summary",
    ...overrideProps,
  };

  render(<PasswordRequirementsPanel {...props} />);
};

describe("PasswordRequirementsPanel", () => {
  it("renders all rule labels and descriptions even when requirement list is incomplete", () => {
    renderPanel({
      requirements: [
        {
          id: PASSWORD_RULES[0]!.id,
          label: PASSWORD_RULES[0]!.label,
          description: PASSWORD_RULES[0]!.description,
          failureMessage: PASSWORD_RULES[0]!.failureMessage,
          met: true,
        },
      ],
    });

    for (const rule of PASSWORD_RULES) {
      expect(
        screen.getByText(rule.label, {
          selector: ".registration-form__password-rule-label",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(rule.description, {
          selector: ".registration-form__password-rule-description",
        }),
      ).toBeInTheDocument();
    }
  });

  it("announces progress summary and toggles met class for completed requirements", () => {
    renderPanel();

    const summary = screen.getByText(/password requirements/i);
    expect(summary).toHaveAttribute("id", "password-panel-summary");

    const metItems = screen.getAllByRole("listitem");
    const metCount = metItems.filter((item) =>
      item.classList.contains("registration-form__password-rule--met"),
    ).length;
    expect(metCount).toBeGreaterThan(0);
  });

  it("marks container as hidden when visibility is disabled", () => {
    renderPanel({ isVisible: false });
    const summary = screen.getByText(/password requirements/i);
    const panel = summary.closest(".registration-form__password-panel");
    expect(panel).toBeTruthy();
    expect(panel?.getAttribute("aria-hidden")).toBe("true");
    expect(panel?.classList.contains("registration-form__password-panel--hidden")).toBe(true);
  });

  it("treats all requirements as satisfied when each is met", () => {
    renderPanel({
      requirements: PASSWORD_RULES.map((rule) => ({
        id: rule.id,
        label: rule.label,
        description: rule.description,
        failureMessage: rule.failureMessage,
        met: true,
      })),
    });

    expect(screen.getByText("All password requirements are satisfied.")).toBeInTheDocument();
  });
});
