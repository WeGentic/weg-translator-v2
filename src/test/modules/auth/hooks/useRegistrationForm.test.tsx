import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRegistrationForm } from "@/modules/auth/hooks/controllers/useRegistrationForm";

vi.mock("@/modules/wizards/client/components/phoneUtils", () => ({
  resolveDefaultCountry: vi.fn(() => "DE"),
}));

vi.mock("@/modules/wizards/client/components/addressUtils", () => ({
  resolveLanguageCode: vi.fn(() => "en"),
}));

vi.mock("@/modules/wizards/client/components/useAddressAutocomplete", () => ({
  useAddressAutocomplete: vi.fn(() => ({
    suggestions: [],
    loading: false,
    error: null,
    clearError: vi.fn(),
    handleFocus: vi.fn(),
    handleBlur: vi.fn(),
    handleKeyDown: vi.fn(),
    handleSuggestionSelect: vi.fn(),
    activeIndex: -1,
    setActiveIndex: vi.fn(),
    showPanel: false,
  })),
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
    dismiss: vi.fn(),
    clearAll: vi.fn(),
  }),
}));

describe("useRegistrationForm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initialises with empty values and company step", () => {
    const { result } = renderHook(() => useRegistrationForm());

    expect(result.current.values.companyName).toBe("");
    expect(result.current.currentStepKey).toBe("company");
    expect(result.current.isFirstStep).toBe(true);
    expect(result.current.isLastStep).toBe(false);
  });

  it("prevents submission when mandatory fields are missing", async () => {
    const { result } = renderHook(() => useRegistrationForm());

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(result.current.errors.companyName).toBe("Company name is required.");
    expect(result.current.isSubmitting).toBe(false);
  });

  it("marks fields as touched when blurred even if empty", () => {
    const { result } = renderHook(() => useRegistrationForm());

    act(() => {
      result.current.handleFieldBlur("companyName");
    });

    expect(result.current.touched.companyName).toBe(true);
  });

  it("marks fields as touched after non-empty blur", () => {
    const { result } = renderHook(() => useRegistrationForm());

    act(() => {
      result.current.handleFieldChange("companyName")({
        target: { value: "Acme Corp" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    act(() => {
      result.current.handleFieldBlur("companyName");
    });

    expect(result.current.touched.companyName).toBe(true);
  });

  it("advances to admin step when company fields are valid", async () => {
    const { result } = renderHook(() => useRegistrationForm());

    act(() => {
      result.current.handleFieldChange("companyName")({
        target: { value: "Acme Corp" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.handleFieldChange("companyAddress")({
        target: { value: "123 Example Rd" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.handleFieldChange("companyEmail")({
        target: { value: "team@acme.test" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.handlePhoneChange("+4912345678");
      result.current.handleFieldChange("companyTaxNumber")({
        target: { value: "DE136695976" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    act(() => {
      result.current.handleNextStep();
    });

    expect(result.current.currentStepKey).toBe("admin");
  });

  it("submits successfully when all fields pass validation", async () => {
    const { result } = renderHook(() => useRegistrationForm());

    act(() => {
      result.current.handleFieldChange("companyName")({
        target: { value: "Acme Corp" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.handleFieldChange("companyAddress")({
        target: { value: "123 Example Rd" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.handleFieldChange("companyEmail")({
        target: { value: "team@acme.test" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.handlePhoneChange("+4912345678");
      result.current.handleFieldChange("companyTaxNumber")({
        target: { value: "DE136695976" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    act(() => {
      vi.advanceTimersByTime(500);
      result.current.handleNextStep();
      result.current.handleFieldChange("adminEmail")({
        target: { value: "admin@acme.test" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.handleFieldChange("adminPassword")({
        target: { value: "S3curePass!42" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.handleFieldChange("adminPasswordConfirm")({
        target: { value: "S3curePass!42" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

  await act(async () => {
    await result.current.handleSubmit({
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>);
    await vi.runAllTimersAsync();
  });

  expect(result.current.isSubmitting).toBe(false);
});

  it("updates phone country based on detected number prefix", () => {
    const { result } = renderHook(() => useRegistrationForm());

    act(() => {
      result.current.handlePhoneChange("+14155552671");
    });

    expect(result.current.phoneCountry).toBe("US");

    act(() => {
      result.current.handlePhoneChange(undefined);
    });

    expect(result.current.phoneCountry).toBe("DE");
  });

  it("preserves raw phone input when formatted value is unavailable", () => {
    const { result } = renderHook(() => useRegistrationForm());

    act(() => {
      result.current.phoneInputRef.current = {
        value: "+39 340 123456",
      } as unknown as HTMLInputElement;
      result.current.handlePhoneChange(undefined);
    });

    expect(result.current.values.companyPhone).toBe("+39 340 123456");
  });

  it("does not flag phone as required when digits exist in the input ref", async () => {
    const { result } = renderHook(() => useRegistrationForm());

    act(() => {
      result.current.handleFieldChange("companyName")({
        target: { value: "Acme Corp" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.handleFieldChange("companyAddress")({
        target: { value: "123 Example Rd" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.handleFieldChange("companyEmail")({
        target: { value: "team@acme.test" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.handleFieldChange("companyTaxNumber")({
        target: { value: "DE136695976" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      result.current.phoneInputRef.current = {
        value: "+39 340 123456",
      } as unknown as HTMLInputElement;
      result.current.handlePhoneChange(undefined);
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(result.current.errors.companyPhone).not.toBe("Company phone is required.");
  });
});
