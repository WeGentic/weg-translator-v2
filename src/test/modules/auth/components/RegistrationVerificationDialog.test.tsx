import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { RegistrationVerificationDialog } from "@/modules/auth/components/dialog/RegistrationVerificationDialog";
import type { NormalizedRegistrationPayload } from "@/modules/auth/hooks/controllers/useRegistrationSubmission";

const payload: NormalizedRegistrationPayload = {
  admin: {
    email: "admin@example.com",
    password: "Supabase!234",
  },
  company: {
    name: "Acme Corp",
    email: "admin@example.com",
    phone: "+15550001234",
    taxId: "US-1234567",
    taxCountryCode: "US",
    address: {
      freeform: "123 Main St, Springfield",
      line1: "123 Main St",
      line2: null,
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
      countryCode: "US",
    },
  },
};

describe("RegistrationVerificationDialog", () => {
  it("guides the user through email verification", () => {
    const handleManual = vi.fn();
    const handleClose = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <RegistrationVerificationDialog
        open
        phase="awaitingVerification"
        attemptId="attempt-123"
        error={null}
        result={null}
        canManualCheck
        onManualCheck={handleManual}
        onClose={handleClose}
        onOpenChange={handleOpenChange}
      />,
    );

    expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
    expect(screen.getByText(/confirmation email we just sent/i)).toBeInTheDocument();
    const manualButton = screen.getByRole("button", { name: /i verified my email/i });
    fireEvent.click(manualButton);
    expect(handleManual).toHaveBeenCalledTimes(1);
  });

  it("shows success details when persistence completes", () => {
    const closeMock = vi.fn();
    render(
      <RegistrationVerificationDialog
        open
        phase="succeeded"
        attemptId="attempt-456"
        error={null}
        result={{ companyId: "company-uuid", adminUuid: "admin-uuid", payload }}
        canManualCheck={false}
        onManualCheck={vi.fn()}
        onClose={closeMock}
        onOpenChange={vi.fn()}
        organizationName="Acme Corp"
      />,
    );

    expect(screen.getByText(/registration complete/i)).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.getByText(/company id/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("has no common accessibility violations", async () => {
    const { container } = render(
      <RegistrationVerificationDialog
        open
        phase="awaitingVerification"
        attemptId="attempt-789"
        error={null}
        result={null}
        canManualCheck
        onManualCheck={vi.fn()}
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
        pendingEmail="pending@example.com"
        onResendVerification={vi.fn()}
        resendDisabled={false}
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
