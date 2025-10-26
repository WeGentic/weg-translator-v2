import { beforeAll, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DashboardView } from "../view";

beforeAll(() => {
  // Radix Select relies on pointer capture APIs not implemented in jsdom.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLElement.prototype as any).hasPointerCapture ??= () => false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLElement.prototype as any).releasePointerCapture ??= () => {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLElement.prototype as any).scrollIntoView ??= () => {};
});

describe("DashboardView", () => {
  it("renders all primary dashboard sections", () => {
    render(<DashboardView />);

    expect(screen.getByRole("region", { name: /Inbox highlights/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Client pulse/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Projects in motion/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Resources & playbooks/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Options & configuration/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Time insight/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Open translation tabs/i })).toBeInTheDocument();
  });

  it("filters projects when search or status filters change", async () => {
    const user = userEvent.setup();
    render(<DashboardView />);

    const projectsRegion = screen.getByRole("region", { name: /Projects in motion/i });
    expect(within(projectsRegion).getAllByRole("listitem")).toHaveLength(3);

    const searchInput = screen.getByRole("searchbox", { name: /Search dashboard content/i });
    await user.type(searchInput, "Legal");

    expect(await within(projectsRegion).findAllByRole("listitem")).toHaveLength(1);
    expect(within(projectsRegion).getByText(/Legal Disclosures Pack/i)).toBeInTheDocument();

    // Clear search and apply status filter via combobox
    await user.clear(searchInput);

    const statusFilter = screen.getByTestId("dashboard-status-filter");
    await user.click(statusFilter);
    await user.click(await screen.findByRole("option", { name: /Review/i }));

    expect(await within(projectsRegion).findAllByRole("listitem")).toHaveLength(1);
    expect(within(projectsRegion).getByText(/Mobile App Strings v3/i)).toBeInTheDocument();
  });
});
