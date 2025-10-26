import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  evaluatePassword,
  type PasswordEvaluationResult,
  type PasswordStrengthTier,
} from "@/modules/auth/utils/passwordPolicy";
import {
  PasswordStrengthMeter,
  type PasswordStrengthMeterProps,
} from "@/modules/auth/components/forms/PasswordStrengthMeter";

const STRONG_PASSWORD = "Great-Pass!2024";
const FAIR_PASSWORD = "StrongPass1234"; // Missing symbol
const EXCELLENT_PASSWORD = "Excellent!Passphrase2024";

const buildEvaluation = (password: string): PasswordEvaluationResult => evaluatePassword(password);

const renderMeter = (
  overrideProps: Partial<PasswordStrengthMeterProps> = {},
): HTMLElement => {
  const evaluation = buildEvaluation(STRONG_PASSWORD);
  const props: PasswordStrengthMeterProps = {
    evaluation,
    isVisible: true,
    summaryId: "password-strength-summary",
    ...overrideProps,
  };

  render(<PasswordStrengthMeter {...props} />);
  const summary = screen.getByText("Password strength");
  return summary.closest(".registration-form__password-strength") as HTMLElement;
};

const expectTierClass = (container: HTMLElement, tier: PasswordStrengthTier) => {
  expect(
    container.classList.contains(`registration-form__password-strength--${tier}`),
  ).toBe(true);
};

describe("PasswordStrengthMeter", () => {
  it("announces strength label and message for provided evaluation", () => {
    const container = renderMeter();

    expect(container).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Password strength")).toBeInTheDocument();
    expect(screen.getByText("Strong")).toBeInTheDocument();
    expect(screen.getByText(/Strong password/)).toBeInTheDocument();
  });

  it("marks component as hidden when not visible", () => {
    renderMeter({ isVisible: false });
    const summary = screen.getByText("Password strength");
    const container = summary.closest(".registration-form__password-strength");
    expect(container?.getAttribute("aria-hidden")).toBe("true");
    expect(container?.classList.contains("registration-form__password-strength--hidden")).toBe(true);
  });

  it("shows helper text when requirements remain unmet", () => {
    const evaluation = buildEvaluation(FAIR_PASSWORD);
    renderMeter({ evaluation });

    expect(
      screen.getByText(/Complete the checklist above to unlock the maximum strength rating./i),
    ).toBeInTheDocument();
  });

  it("omits helper text when all requirements are satisfied", () => {
    const evaluation = buildEvaluation(EXCELLENT_PASSWORD);
    renderMeter({ evaluation });

    expect(
      screen.queryByText(/Complete the checklist above to unlock the maximum strength rating./i),
    ).not.toBeInTheDocument();
  });

  it("activates segments based on strength tier", () => {
    const evaluation = buildEvaluation(EXCELLENT_PASSWORD);
    const container = renderMeter({ evaluation });
    expectTierClass(container, evaluation.strength.tier);

    const activeSegments = container.querySelectorAll(
      ".registration-form__password-strength-segment--active",
    );
    expect(activeSegments.length).toBeGreaterThan(0);
  });
});
