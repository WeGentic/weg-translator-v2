import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginRoute } from "@/modules/auth/routes";

vi.mock("@/assets/LOGO-SVG.svg", () => ({
  default: "logo.svg",
}));

vi.mock("@/assets/LOGIN_BACKGROUND_.png", () => ({
  default: "background.png",
}));

const authMock = {
  login: vi.fn(),
  logout: vi.fn(),
  isLoading: false,
  isAuthenticated: false,
  isVerified: false,
  user: null,
};

vi.mock("@/app/providers", async () => {
  const actual = await vi.importActual<typeof import("@/app/providers")>("@/app/providers");
  return {
    ...actual,
    useAuth: () => authMock,
  };
});

describe("LoginRoute registration section", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the login form with a link to the registration page", () => {
    render(<LoginRoute />);

    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();

    const link = screen.getByText(/register your organization/i).closest("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/register");
  });
});
