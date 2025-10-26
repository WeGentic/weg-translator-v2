import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRegistrationSubmission } from "@/modules/auth/hooks/controllers/useRegistrationSubmission";
import type { NormalizedRegistrationPayload } from "@/modules/auth/hooks/controllers/useRegistrationSubmission";

const signUpMock = vi.fn();
const getUserMock = vi.fn();
const functionsInvokeMock = vi.fn();
const toastMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock("@/core/config", () => ({
  supabase: {
    auth: {
      signUp: signUpMock,
      getUser: getUserMock,
    },
    functions: {
      invoke: functionsInvokeMock,
    },
  },
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/core/logging", () => ({
  logger: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
    error: loggerErrorMock,
  },
}));

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

const verifiedSupabaseUser = {
  id: "admin-uuid-1",
  email: "admin@example.com",
  email_confirmed_at: new Date().toISOString(),
};

const unverifiedSupabaseUser = {
  id: "admin-uuid-1",
  email: "admin@example.com",
  email_confirmed_at: null,
};

describe("useRegistrationSubmission", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    signUpMock.mockReset();
    getUserMock.mockReset();
    functionsInvokeMock.mockReset();
    toastMock.mockReset();
    loggerInfoMock.mockReset();
    loggerWarnMock.mockReset();
    loggerErrorMock.mockReset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("moves to awaiting verification after successful sign-up", async () => {
    signUpMock.mockResolvedValueOnce({ data: { user: { id: "admin-uuid-1" } }, error: null });

    const { result } = renderHook(() => useRegistrationSubmission());

    await act(async () => {
      await result.current.submit(payload);
    });

    expect(signUpMock).toHaveBeenCalledWith({
      email: payload.admin.email,
      password: payload.admin.password,
      options: {
        data: {
          company_name: payload.company.name,
          company_phone: payload.company.phone,
          tax_id: payload.company.taxId,
        },
      },
    });
    expect(result.current.phase).toBe("awaitingVerification");
    expect(result.current.attemptId).toBeTruthy();
    expect(toastMock).toHaveBeenCalledWith({
      title: "Verify your email",
      description: "We sent a confirmation link to your inbox. Open it to continue.",
    });
  });

  it("captures failed sign-up attempts", async () => {
    signUpMock.mockResolvedValueOnce({ data: { user: null }, error: new Error("Signup failed") });

    const { result } = renderHook(() => useRegistrationSubmission());

    await act(async () => {
      await result.current.submit(payload);
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.error?.message).toContain("Signup failed");
    expect(toastMock).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Registration failed",
      description: expect.stringContaining("Signup failed"),
    });
  });

  it("completes verification and persistence on manual check", async () => {
    signUpMock.mockResolvedValueOnce({ data: { user: { id: "admin-uuid-1" } }, error: null });
    getUserMock
      .mockResolvedValueOnce({ data: { user: unverifiedSupabaseUser }, error: null })
      .mockResolvedValueOnce({ data: { user: verifiedSupabaseUser }, error: null });

    functionsInvokeMock.mockResolvedValueOnce({
      data: {
        data: {
          companyId: "company-uuid-1",
          adminUuid: "admin-uuid-1",
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useRegistrationSubmission());

    await act(async () => {
      await result.current.submit(payload);
    });

    // First manual check (still unverified)
    await act(async () => {
      await result.current.confirmVerification({ manual: true });
    });
    expect(result.current.phase).toBe("awaitingVerification");

    vi.advanceTimersByTime(2_000);

    // Second manual check (verified)
    await act(async () => {
      await result.current.confirmVerification({ manual: true });
    });

    expect(getUserMock).toHaveBeenCalledTimes(2);
    expect(functionsInvokeMock).toHaveBeenCalledWith("register-organization", {
      body: expect.objectContaining({
        attemptId: result.current.attemptId,
        company: expect.objectContaining({ name: payload.company.name }),
      }),
      headers: expect.any(Object),
    });
    expect(result.current.phase).toBe("succeeded");
    expect(result.current.result).toEqual({
      companyId: "company-uuid-1",
      adminUuid: "admin-uuid-1",
      payload,
    });
    expect(toastMock).toHaveBeenLastCalledWith({
      title: "Registration complete",
      description: "Your organization has been verified and created successfully.",
    });
  });
});
