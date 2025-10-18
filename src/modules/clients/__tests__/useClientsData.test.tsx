import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useClientsData } from "@/modules/clients/hooks/useClientsData";
import type { ClientRecord } from "@/shared/types/database";
import { listClientRecords } from "@/core/ipc/db/clients";

vi.mock("@/core/ipc/db/clients", () => ({
  listClientRecords: vi.fn(),
}));

const mockListClientRecords = vi.mocked(listClientRecords);

const BASE_CLIENTS: ClientRecord[] = [
  {
    clientUuid: "client-1",
    name: "Acme Localization",
    email: "contact@acme.com",
    phone: null,
    address: "123 Main Street",
    vatNumber: null,
    note: "Preferred for EN>FR",
  },
  {
    clientUuid: "client-2",
    name: "Babel Studios",
    email: null,
    phone: "+33 01 23 45 67",
    address: "Paris HQ",
    vatNumber: "FR123456789",
    note: null,
  },
  {
    clientUuid: "client-3",
    name: "Chronicle Media",
    email: null,
    phone: null,
    address: "  ",
    vatNumber: null,
    note: "  ",
  },
];

describe("useClientsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads clients and applies search criteria", async () => {
    mockListClientRecords.mockResolvedValue([...BASE_CLIENTS]);

    const { result, rerender } = renderHook(({ search }: { search: string }) => useClientsData({ search }), {
      initialProps: { search: "" },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.clients).toHaveLength(3);

    rerender({ search: "acme" });
    await waitFor(() => {
      expect(result.current.clients).toHaveLength(1);
      expect(result.current.clients[0]?.name).toBe("Acme Localization");
    });

    act(() => {
      result.current.upsertClient({
        clientUuid: "client-4",
        name: "Atlas Partners",
        email: "hello@atlas.dev",
        phone: "",
        address: "",
        vatNumber: "",
        note: "",
      });
    });

    rerender({ search: "" });
    await waitFor(() => {
      expect(result.current.clients[0]?.name).toBe("Acme Localization");
      expect(result.current.clients).toHaveLength(4);
    });
  });

  it("surfaces errors and refreshes successfully", async () => {
    mockListClientRecords.mockRejectedValueOnce(new Error("network down"));
    mockListClientRecords.mockResolvedValueOnce([...BASE_CLIENTS.slice(0, 1)]);

    const { result } = renderHook(() => useClientsData({ search: "" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/network down/i);
    expect(result.current.clients).toHaveLength(0);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.clients).toHaveLength(1);
  });
});
