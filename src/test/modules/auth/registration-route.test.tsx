import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { RegistrationRoute } from "@/modules/auth/routes/RegistrationRoute";

vi.mock("@/assets/LOGO-SVG.svg", () => ({
  default: "logo.svg",
}));

vi.mock("@/assets/LOGIN_BACKGROUND_.png", () => ({
  default: "background.png",
}));

const createObjectURLMock = vi.fn(() => "blob:mock-url");
const revokeObjectURLMock = vi.fn();

beforeAll(() => {
  vi.stubGlobal("URL", {
    createObjectURL: createObjectURLMock,
    revokeObjectURL: revokeObjectURLMock,
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("RegistrationRoute", () => {
  afterEach(() => {
    cleanup();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
  });

  it("renders the stepper and enforces validation before advancing", async () => {
    const user = userEvent.setup();
    render(<RegistrationRoute />);

    const stepper = screen.getByRole("navigation", { name: /registration progress/i });
    const stepButtons = within(stepper).getAllByRole("button");
    expect(stepButtons[0]).toHaveAttribute("aria-current", "step");

    await user.click(screen.getByRole("button", { name: /continue to admin details/i }));
    expect(screen.getByText(/company name is required/i)).toBeInTheDocument();
    expect(stepButtons[0]).toHaveAttribute("aria-current", "step");

    await user.type(screen.getByLabelText(/company name/i), "Acme Corp");
    await user.type(screen.getByLabelText(/company address/i), "123 Example St");
    await user.type(screen.getByLabelText(/company email/i), "team@acme.test");
    await user.type(screen.getByLabelText(/company phone/i), "+1 555 0100");
    await user.type(screen.getByLabelText(/company tax number/i), "TAX-12345");

    await user.click(screen.getByRole("button", { name: /continue to admin details/i }));
    expect(stepButtons[1]).toHaveAttribute("aria-current", "step");
  });

  it("associates the logo upload with its hint and summary", async () => {
    const user = userEvent.setup();
    render(<RegistrationRoute />);

    const logoInput = screen.getByLabelText("Company logo");
    expect(logoInput).toBeInTheDocument();

    const describedBy = logoInput.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("company-logo-hint");
    expect(describedBy).toContain("company-logo-summary");

    await user.upload(
      logoInput,
      new File(["logo"], "logo.png", {
        type: "image/png",
      }),
    );

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(await screen.findByText(/selected file/i)).toBeInTheDocument();
  });
});
