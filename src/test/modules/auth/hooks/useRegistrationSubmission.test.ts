import { act, renderHook } from "@testing-library/react";
import { AuthError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRegistrationSubmission } from "@/modules/auth/hooks/controllers/useRegistrationSubmission";
import type { NormalizedRegistrationPayload } from "@/modules/auth/hooks/controllers/useRegistrationSubmission";

const supabaseMocks = vi.hoisted(() => ({
  signUpMock: vi.fn(),
  getUserMock: vi.fn(),
  getSessionMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  functionsInvokeMock: vi.fn(),
  toastMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  loggerDebugMock: vi.fn(),
}));

const orphanDetectionMocks = vi.hoisted(() => ({
  checkIfOrphanedMock: vi.fn(),
}));

vi.mock("@/core/config", () => ({
  supabase: {
    auth: {
      signUp: supabaseMocks.signUpMock,
      getUser: supabaseMocks.getUserMock,
      getSession: supabaseMocks.getSessionMock,
      signInWithPassword: supabaseMocks.signInWithPasswordMock,
    },
    functions: {
      invoke: supabaseMocks.functionsInvokeMock,
    },
  },
}));

vi.mock("@/modules/auth/utils/orphanDetection", () => ({
  checkIfOrphaned: orphanDetectionMocks.checkIfOrphanedMock,
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({ toast: supabaseMocks.toastMock }),
}));

vi.mock("@/core/logging", () => ({
  logger: {
    info: supabaseMocks.loggerInfoMock,
    warn: supabaseMocks.loggerWarnMock,
    error: supabaseMocks.loggerErrorMock,
    debug: supabaseMocks.loggerDebugMock,
  },
}));

const {
  signUpMock,
  getUserMock,
  getSessionMock,
  signInWithPasswordMock,
  functionsInvokeMock,
  toastMock,
  loggerInfoMock,
  loggerWarnMock,
  loggerErrorMock,
  loggerDebugMock,
} = supabaseMocks;
const { checkIfOrphanedMock } = orphanDetectionMocks;

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
    getSessionMock.mockReset();
    signInWithPasswordMock.mockReset();
    functionsInvokeMock.mockReset();
    toastMock.mockReset();
    loggerInfoMock.mockReset();
    loggerWarnMock.mockReset();
    loggerErrorMock.mockReset();
    loggerDebugMock.mockReset();
    checkIfOrphanedMock.mockReset();

    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    signInWithPasswordMock.mockResolvedValue({ data: { user: verifiedSupabaseUser, session: {} }, error: null });
    functionsInvokeMock.mockResolvedValue({
      data: {
        data: {
          companyId: "company-uuid-default",
          adminUuid: "admin-uuid-default",
          membershipId: "membership-uuid-default",
        },
      },
      error: null,
    });
    checkIfOrphanedMock.mockResolvedValue({
      isOrphaned: false,
      classification: null,
      metrics: {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalDurationMs: 5,
        queryDurationMs: 2,
        attemptCount: 1,
        timedOut: false,
        hadError: false,
      },
      hasCompanyData: true,
      hasAdminData: true,
    });
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

  it("resumes registration when Supabase reports an existing verified account", async () => {
    const conflictError = new AuthError("User already registered", 400);
    (conflictError as { code?: string }).code = "user_already_exists";
    signUpMock.mockResolvedValueOnce({ data: { user: null }, error: conflictError });

    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: verifiedSupabaseUser, session: {} },
      error: null,
    });

    const { result } = renderHook(() => useRegistrationSubmission());

    await act(async () => {
      await result.current.submit(payload);
    });

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: payload.admin.email,
      password: payload.admin.password,
    });
    expect(functionsInvokeMock).toHaveBeenCalledWith("register-organization", expect.any(Object));
    expect(checkIfOrphanedMock).toHaveBeenCalledWith(verifiedSupabaseUser.id);
    expect(result.current.phase).toBe("succeeded");
    expect(result.current.result).toMatchObject({
      companyId: "company-uuid-default",
      adminUuid: "admin-uuid-default",
      membershipId: "membership-uuid-default",
      payload,
    });
    expect(toastMock).toHaveBeenLastCalledWith({
      title: "Registration complete",
      description: `Your organization "${payload.company.name}" has been created successfully.`,
    });
  });

  it("waits for email confirmation when existing account is unverified", async () => {
    const conflictError = new AuthError("User already registered", 400);
    (conflictError as { code?: string }).code = "user_already_exists";
    signUpMock.mockResolvedValueOnce({ data: { user: null }, error: conflictError });

    const emailNotConfirmed = new AuthError("Email not confirmed", 400);
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: emailNotConfirmed,
    });

    const { result } = renderHook(() => useRegistrationSubmission());

    await act(async () => {
      await result.current.submit(payload);
    });

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: payload.admin.email,
      password: payload.admin.password,
    });
    expect(result.current.phase).toBe("awaitingVerification");
    expect(result.current.adminUuid).toBeNull();
    expect(toastMock).toHaveBeenLastCalledWith({
      title: "Verify your email",
      description: expect.stringContaining("existing account"),
    });
  });

  it("completes verification and persistence on manual check", async () => {
    signUpMock.mockResolvedValueOnce({ data: { user: { id: "admin-uuid-1" } }, error: null });
    getSessionMock
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: { user: verifiedSupabaseUser } }, error: null });

    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "Email not confirmed", status: 400 },
    });

    functionsInvokeMock.mockResolvedValueOnce({
      data: {
        data: {
          companyId: "company-uuid-1",
          adminUuid: "admin-uuid-1",
          membershipId: "membership-uuid-1",
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

    expect(getSessionMock).toHaveBeenCalledTimes(2);
    expect(signInWithPasswordMock).toHaveBeenCalledTimes(1);
    expect(getUserMock).not.toHaveBeenCalled();
    expect(functionsInvokeMock).toHaveBeenCalledWith("register-organization", {
      body: expect.objectContaining({
        attemptId: result.current.attemptId,
        company: expect.objectContaining({ name: payload.company.name }),
      }),
      headers: expect.any(Object),
    });
    expect(result.current.phase).toBe("succeeded");
    expect(result.current.result).toMatchObject({
      companyId: "company-uuid-1",
      adminUuid: "admin-uuid-1",
      membershipId: "membership-uuid-1",
      payload,
    });
    expect(toastMock).toHaveBeenLastCalledWith({
      title: "Registration complete",
      description: `Your organization "${payload.company.name}" has been verified and created successfully. You have been assigned as the owner.`,
    });
  });
});
