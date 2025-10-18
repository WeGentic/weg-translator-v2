import { beforeEach, describe, expect, it, vi } from "vitest";

import { listClientRecords } from "../clients";
import { safeInvoke } from "../../request";

vi.mock("../../request", () => ({
  safeInvoke: vi.fn(),
}));

const mockSafeInvoke = vi.mocked(safeInvoke);

describe("ipc/db/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalises legacy snake_case payloads into client records", async () => {
    mockSafeInvoke.mockResolvedValueOnce([
      {
        client_uuid: "client-legacy",
        name: "Legacy Org",
        email: "legacy@example.com",
        phone: null,
        address: "123 Legacy Street",
        vat_number: "VAT-123",
        note: null,
      },
    ]);

    const result = await listClientRecords();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      clientUuid: "client-legacy",
      name: "Legacy Org",
      email: "legacy@example.com",
      address: "123 Legacy Street",
      vatNumber: "VAT-123",
    });
  });

  it("raises when payload omits the client identifier", async () => {
    mockSafeInvoke.mockResolvedValueOnce([
      {
        name: "Broken Org",
      },
    ]);

    await expect(listClientRecords()).rejects.toThrow(/client without an id/i);
  });
});
