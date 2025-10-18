import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useClientsData } from "@/modules/clients/hooks/useClientsData";
import type { ClientsFilterValue } from "@/modules/clients/constants";
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

  it("loads clients and applies search/filter criteria", async () => {
    mockListClientRecords.mockResolvedValue([...BASE_CLIENTS]);

    type HookProps = { search: string; filter: ClientsFilterValue };
    const initialProps: HookProps = { search: "", filter: "all" };

    const { result, rerender } = renderHook((props: HookProps) => useClientsData(props), {
      initialProps,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.clients).toHaveLength(3);

    rerender({ search: "acme", filter: "all" });
    await waitFor(() => {
      expect(result.current.clients).toHaveLength(1);
      expect(result.current.clients[0]?.name).toBe("Acme Localization");
    });

    rerender({ search: "", filter: "with-contact" });
    await waitFor(() => {
      expect(result.current.clients).toHaveLength(2);
    });

    rerender({ search: "", filter: "missing-contact" });
    await waitFor(() => {
      expect(result.current.clients).toHaveLength(1);
      expect(result.current.clients[0]?.name).toBe("Chronicle Media");
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

    rerender({ search: "", filter: "with-contact" });
    await waitFor(() => {
      expect(result.current.clients[0]?.name).toBe("Acme Localization");
      expect(result.current.clients).toHaveLength(3);
    });
  });

  it("surfaces errors and refreshes successfully", async () => {
    mockListClientRecords.mockRejectedValueOnce(new Error("network down"));
    mockListClientRecords.mockResolvedValueOnce([...BASE_CLIENTS.slice(0, 1)]);

    const { result } = renderHook(() => useClientsData({ search: "", filter: "all" }));

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
