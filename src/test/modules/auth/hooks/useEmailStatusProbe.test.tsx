import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";

import { useEmailStatusProbe } from "@/modules/auth/hooks/controllers/useEmailStatusProbe";

const { invokeMock, resendMock, toastMock, getSessionMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  resendMock: vi.fn(),
  toastMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("@/core/config", () => ({
  SUPABASE_ANON_KEY: "anon-key",
  supabase: {
    functions: {
      invoke: invokeMock,
    },
    auth: {
      resend: resendMock,
      getSession: getSessionMock,
    },
  },
}));

vi.mock("@/core/logging", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({
    toast: toastMock,
    dismiss: vi.fn(),
    clearAll: vi.fn(),
  }),
}));

describe("useEmailStatusProbe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invokeMock.mockReset();
    resendMock.mockReset();
    toastMock.mockReset();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    if (!(globalThis.crypto as Crypto | undefined)?.subtle) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires -- Node crypto polyfill
      const { webcrypto } = require("crypto");
      Object.defineProperty(globalThis, "crypto", {
        value: webcrypto,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps idle state when email is empty", () => {
    const { result } = renderHook(() =>
      useEmailStatusProbe({ email: "", attemptId: null }),
    );

    expect(result.current.status).toBe("idle");
    expect(result.current.isLoading).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("debounces and resolves email status", async () => {
    invokeMock.mockResolvedValue({
      data: {
        data: {
          status: "not_registered",
          verifiedAt: null,
          lastSignInAt: null,
          correlationId: "cid-1",
        },
      },
      error: null,
      response: new Response(null, { status: 200 }),
    });

    const { result } = renderHook(() =>
      useEmailStatusProbe({ email: "admin@example.com", attemptId: "attempt-1" }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const [, options] = invokeMock.mock.calls[0] ?? [];
    expect(options.headers.Authorization).toBe("Bearer anon-key");
    expect(result.current.status).toBe("not_registered");
    expect(result.current.result?.correlationId).toBe("cid-1");
  });

  it("surfaces rate-limit errors with retry hint", async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          code: "rate_limited",
          message: "Too many requests.",
        },
        correlationId: "cid-429",
      }),
      {
        status: 429,
        headers: {
          "Retry-After": "45",
        },
      },
    );

    invokeMock.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(response),
      response,
    });

    const { result } = renderHook(() =>
      useEmailStatusProbe({ email: "admin@example.com", attemptId: "attempt-2" }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error?.code).toBe("rate_limited");
    expect(result.current.error?.retryAfterSeconds).toBe(45);
    expect(toastMock).toHaveBeenCalled();
  });

  it("forceCheck bypasses cache and re-invokes", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "user-token" } },
      error: null,
    });
    invokeMock.mockResolvedValue({
      data: {
        data: {
          status: "not_registered",
          verifiedAt: null,
          lastSignInAt: null,
          correlationId: "cid-cache",
        },
      },
      error: null,
      response: new Response(null, { status: 200 }),
    });

    const { result } = renderHook(() =>
      useEmailStatusProbe({ email: "admin@example.com", attemptId: "attempt-3" }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    invokeMock.mockClear();

    await act(async () => {
      await result.current.forceCheck();
      await Promise.resolve();
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const [, invokeOptions] = invokeMock.mock.calls[0] ?? [];
    expect(invokeOptions.headers.Authorization).toBe("Bearer user-token");
  });

  it("resendVerification triggers Supabase auth resend when status is unverified", async () => {
    invokeMock.mockResolvedValue({
      data: {
        data: {
          status: "registered_unverified",
          verifiedAt: null,
          lastSignInAt: null,
          correlationId: "cid-resend",
        },
      },
      error: null,
      response: new Response(null, { status: 200 }),
    });
    resendMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() =>
      useEmailStatusProbe({ email: "admin@example.com", attemptId: "attempt-4" }),
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(result.current.status).toBe("registered_unverified");

    await act(async () => {
      await result.current.resendVerification();
    });

    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "admin@example.com",
    });
  });

  it("stops auto-retrying after a network failure for the same email", async () => {
    invokeMock.mockRejectedValue(new Error("Network request failed"));

    renderHook(() =>
      useEmailStatusProbe({ email: "admin@example.com", attemptId: "attempt-5" }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
  });
});
