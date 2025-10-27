import { fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RegistrationAddressState,
  UseRegistrationFormResult,
} from "@/modules/auth/hooks/controllers/useRegistrationForm";
import type { EmailStatusProbeApi } from "@/modules/auth/hooks/controllers/useEmailStatusProbe";
import type { PasswordEvaluationResult } from "@/modules/auth/utils/passwordPolicy";
import { RegistrationForm } from "@/modules/auth/components/RegistrationForm";

vi.mock("@/assets/LOGO-SVG.svg", () => ({ default: "logo.svg" }));

const mockNavigate = vi.fn();
const mockSetMessage = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/shared/transitions/PageTransitionProvider", () => ({
  usePageTransition: () => ({
    setMessage: mockSetMessage,
  }),
}));

vi.mock("@/core/logging", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/modules/auth/hooks/controllers/useRegistrationForm", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/auth/hooks/controllers/useRegistrationForm")
  >("@/modules/auth/hooks/controllers/useRegistrationForm");
  return {
    ...actual,
    useRegistrationForm: vi.fn(() => mockFormState),
  };
});

function createProbe(overrides: Partial<EmailStatusProbeApi> = {}): EmailStatusProbeApi {
  return {
    status: "idle",
    result: null,
    isLoading: false,
    error: null,
    lastCheckedEmail: null,
    reset: vi.fn(),
    forceCheck: vi.fn(),
    resendVerification: vi.fn(),
    ...overrides,
  };
}

function createPasswordEvaluation(): PasswordEvaluationResult {
  return {
    requirements: [],
    allRequirementsMet: false,
    strength: {
      tier: "weak",
      score: 0,
      label: "Weak",
      message: "Add more characters for a stronger password.",
    },
  };
}

function createAddressState(): RegistrationAddressState {
  return {
    suggestions: [],
    loading: false,
    error: null,
    lockedValue: null,
    showPanel: false,
    activeIndex: -1,
    setActiveIndex: vi.fn(),
    handleFocus: vi.fn(),
    handleBlur: vi.fn(),
    handleKeyDown: vi.fn(),
    handleSuggestionSelect: vi.fn(),
    clearSelection: vi.fn(),
    clearError: vi.fn(),
  };
}

const defaultValues = {
  companyName: "Acme Corp",
  companyAddress: "123 Market Street",
  companyEmail: "team@acme.test",
  companyPhone: "+15550000000",
  companyTaxNumber: "US1234567",
  adminEmail: "admin@acme.test",
  adminPassword: "",
  adminPasswordConfirm: "",
};

const emptyErrors = {
  companyName: "",
  companyAddress: "",
  companyEmail: "",
  companyPhone: "",
  companyTaxNumber: "",
  adminEmail: "",
  adminPassword: "",
  adminPasswordConfirm: "",
};

const untouched = {
  companyName: false,
  companyAddress: false,
  companyEmail: false,
  companyPhone: false,
  companyTaxNumber: false,
  adminEmail: true,
  adminPassword: false,
  adminPasswordConfirm: false,
};

const baseProbeResult = {
  attemptId: "attempt-123",
  correlationId: "corr-123",
  status: "not_registered" as const,
  checkedAt: Date.now(),
  lastSignInAt: null,
  verifiedAt: null,
};

let mockFormState: UseRegistrationFormResult;

function createFormState(
  overrides: Partial<UseRegistrationFormResult> = {},
): UseRegistrationFormResult {
  return {
    values: { ...defaultValues },
    errors: { ...emptyErrors },
    touched: { ...untouched },
    emailStatusProbe: createProbe({
      status: "not_registered",
      result: baseProbeResult,
    }),
    isSubmitting: false,
    isSubmissionLocked: false,
    stepIndex: 1,
    currentStepKey: "admin",
    currentStepBlockingLabels: [],
    formBlockingLabels: [],
    isFirstStep: false,
    isLastStep: true,
    isCurrentStepValid: true,
    isFormValid: true,
    continueTooltipMessage: "Continue",
    submitTooltipMessage: "Submit",
    phoneCountry: "US",
    phoneValue: "+15550000000",
    defaultPhoneCountry: "US",
    phoneDialCode: "+1",
    phoneInputRef: { current: null },
    addressInputRef: { current: null },
    address: createAddressState(),
    handleFieldChange: () => vi.fn(),
    handleFieldBlur: vi.fn(),
    handlePhoneChange: vi.fn(),
    handlePhoneCountryChange: vi.fn(),
    handleCompanyAddressChange: vi.fn(),
    handleCompanyAddressClear: vi.fn(),
    handleSubmit: vi.fn(),
    handleNextStep: vi.fn(),
    handlePreviousStep: vi.fn(),
    handleStepSelect: vi.fn(),
    goToStep: vi.fn(),
    getFieldError: () => "",
    hasFieldBlockingError: () => false,
    passwordEvaluation: createPasswordEvaluation(),
    submissionPhase: "idle",
    submissionAttemptId: null,
    submissionError: null,
    submissionResult: null,
    handleManualVerificationCheck: vi.fn(),
    resetSubmission: vi.fn(),
    ...overrides,
  };
}

describe("RegistrationForm integration scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormState = createFormState();
  });

  it("shows a success banner for new admin emails", () => {
    mockFormState = createFormState({
      emailStatusProbe: createProbe({
        status: "not_registered",
        result: { ...baseProbeResult, status: "not_registered" },
      }),
    });

    render(<RegistrationForm />);

    expect(screen.getByText(/you’re good to go/i)).toBeInTheDocument();
    expect(
      screen.getByText(/this email hasn’t been used yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log in/i })).not.toBeInTheDocument();
  });

  it("blocks submission for verified accounts and routes to login", () => {
    const resetSpy = vi.fn();
    mockFormState = createFormState({
      emailStatusProbe: createProbe({
        status: "registered_verified",
        result: { ...baseProbeResult, status: "registered_verified" },
        reset: resetSpy,
      }),
      currentStepBlockingLabels: ["Administrator email is already registered."],
      formBlockingLabels: ["Administrator email is already registered."],
    });

    render(<RegistrationForm />);

    const loginButton = screen.getByRole("button", { name: /log in/i });
    fireEvent.click(loginButton);

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/login" });
    expect(mockSetMessage).toHaveBeenCalledWith("Returning to login…");
    expect(resetSpy).toHaveBeenCalled();

    const recoverButton = screen.getByRole("button", { name: /recover password/i });
    fireEvent.click(recoverButton);

    expect(mockSetMessage).toHaveBeenCalledWith(
      "Redirecting to login so you can recover your password.",
    );
    expect(mockNavigate).toHaveBeenLastCalledWith({ to: "/login" });
  });

  it("opens the verification dialog and supports resend for unverified accounts", async () => {
    const forceCheckSpy = vi.fn();
    const resendSpy = vi.fn();
    mockFormState = createFormState({
      emailStatusProbe: createProbe({
        status: "registered_unverified",
        lastCheckedEmail: "admin@acme.test",
        result: { ...baseProbeResult, status: "registered_unverified" },
        forceCheck: forceCheckSpy,
        resendVerification: resendSpy,
      }),
    });

    render(<RegistrationForm />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByText(/finish verifying your email/i),
    ).toBeInTheDocument();

    const [resumeButton] = screen.getAllByRole("button", {
      name: /resume verification/i,
    });
    fireEvent.click(resumeButton);
    expect(forceCheckSpy).toHaveBeenCalledTimes(1);

    const [resendButton] = screen.getAllByRole("button", { name: /resend email/i });
    fireEvent.click(resendButton);
    expect(resendSpy).toHaveBeenCalledTimes(1);
  });

  it("meets accessibility guidelines for the returning-user flow", async () => {
    mockFormState = createFormState({
      emailStatusProbe: createProbe({
        status: "registered_unverified",
        lastCheckedEmail: "admin@acme.test",
        result: { ...baseProbeResult, status: "registered_unverified" },
      }),
    });

    const { container } = render(<RegistrationForm />);
    await screen.findByRole("dialog");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
