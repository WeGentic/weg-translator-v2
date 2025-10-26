import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUserAccountDialog } from "@/modules/auth/hooks/controllers/useUserAccountDialog";

const logoutMock = vi.fn();
const toastMock = vi.fn();
const navigateMock = vi.fn(() => Promise.resolve());

vi.mock("@/modules/auth/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { name: "Jane Doe", email: "jane@example.com", emailVerified: true },
    logout: logoutMock,
    isAuthenticated: true,
    isVerified: true,
  }),
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    navigate: navigateMock,
  }),
}));

describe("useUserAccountDialog", () => {
  afterEach(() => {
    logoutMock.mockReset();
    toastMock.mockReset();
    navigateMock.mockReset();
  });

  it("transitions to confirm stage when logout is requested", () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useUserAccountDialog({
        open: true,
        onOpenChange,
      }),
    );

    expect(result.current.stage).toBe("profile");

    act(() => {
      result.current.handleRequestLogout();
    });

    expect(result.current.stage).toBe("confirm");
  });

  it("completes logout flow and triggers toast/navigation", async () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useUserAccountDialog({
        open: true,
        onOpenChange,
      }),
    );

    act(() => {
      result.current.handleRequestLogout();
    });

    await act(async () => {
      await result.current.handleConfirmLogout();
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith({
      title: "Signed out",
      description: "You have been signed out of this session.",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/login", search: { redirect: "/" } });
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("records error when logout fails", async () => {
    logoutMock.mockRejectedValueOnce(new Error("network failure"));
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useUserAccountDialog({
        open: true,
        onOpenChange,
      }),
    );

    act(() => {
      result.current.handleRequestLogout();
    });

    await act(async () => {
      await result.current.handleConfirmLogout();
    });

    expect(result.current.error).toBe("network failure");
    expect(toastMock).toHaveBeenLastCalledWith({
      variant: "destructive",
      title: "Sign out failed",
      description: "network failure",
    });
    expect(result.current.pending).toBe(false);
  });
});
