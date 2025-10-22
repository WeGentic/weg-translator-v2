import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ClientRecord } from "@/shared/types/database";

import { ClientsContent } from "../ClientsContent";

const baseClient: ClientRecord = {
  clientUuid: "client-1",
  name: "Acme Corp",
  email: null,
  phone: null,
  address: null,
  vatNumber: null,
  note: null,
};

describe("ClientsContent table selection", () => {
  it("toggles row selection when a checkbox is clicked", async () => {
    const user = userEvent.setup();
    const clients: ClientRecord[] = [
      baseClient,
      { ...baseClient, clientUuid: "client-2", name: "Beta LLC" },
    ];

    render(
      <ClientsContent
        clients={clients}
        search=""
      />,
    );

    const getRowCheckbox = () => screen.getByRole("checkbox", { name: /Select Acme Corp/i });
    expect(getRowCheckbox()).toHaveAttribute("aria-checked", "false");

    await user.click(getRowCheckbox());
    await waitFor(() => {
      expect(getRowCheckbox()).toHaveAttribute("aria-checked", "true");
    });
  });
});
