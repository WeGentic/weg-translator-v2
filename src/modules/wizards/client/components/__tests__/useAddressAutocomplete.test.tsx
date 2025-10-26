import { act, renderHook, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAddressAutocomplete } from "../useAddressAutocomplete";
import {
  autocompleteAddress,
  resolveAddressDetails,
  type AddressSuggestion,
} from "@/core/ipc/places";

vi.mock("@/core/ipc/places", () => ({
  autocompleteAddress: vi.fn(),
  resolveAddressDetails: vi.fn(),
}));

const mockAutocomplete = vi.mocked(autocompleteAddress);
const mockResolveDetails = vi.mocked(resolveAddressDetails);

function createSuggestion(): AddressSuggestion {
  return {
    id: "places/ChIJ123456",
    primaryText: "Example HQ",
    secondaryText: "Brussels, Belgium",
    structured: {
      components: {
        streetNumber: "1",
        route: "Rue Example",
        locality: "Brussels",
        countryCode: "BE",
      },
      formattedAddress: "Example HQ, Brussels, Belgium",
      placeId: "ChIJ123456",
      resourceName: "places/ChIJ123456",
      types: ["street_address"],
    },
    resourceName: "places/ChIJ123456",
    types: ["street_address"],
    distanceMeters: 145,
  };
}

describe("useAddressAutocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads suggestions after debounce", async () => {
    vi.useFakeTimers();

    const suggestion = createSuggestion();
    mockAutocomplete.mockResolvedValue({
      sessionToken: "server-token",
      suggestions: [suggestion],
    });

    const fieldRef = { current: null } as MutableRefObject<HTMLInputElement | null>;
    const onResolve = vi.fn();

    const { result, rerender } = renderHook(
      ({ query }) =>
        useAddressAutocomplete<HTMLInputElement>({
          query,
          language: "en",
          countryBias: ["be"],
          fieldRef,
          onResolve,
        }),
      { initialProps: { query: "" } },
    );

    act(() => {
      result.current.handleFocus();
    });

    rerender({ query: "exa" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(260);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.suggestions).toHaveLength(1);
    expect(mockAutocomplete).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "exa",
        language: "en",
        countryBias: ["be"],
        sessionToken: expect.any(String),
      }),
    );
  });

  it("surfaces autocomplete errors", async () => {
    vi.useFakeTimers();

    mockAutocomplete.mockRejectedValueOnce(new Error("quota exceeded"));

    const fieldRef = { current: null } as MutableRefObject<HTMLInputElement | null>;
    const onResolve = vi.fn();

    const { result, rerender } = renderHook(
      ({ query }) =>
        useAddressAutocomplete<HTMLInputElement>({
          query,
          language: "en",
          countryBias: undefined,
          fieldRef,
          onResolve,
        }),
      { initialProps: { query: "" } },
    );

    act(() => {
      result.current.handleFocus();
    });

    rerender({ query: "err" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(260);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.suggestions).toHaveLength(0);
    expect(result.current.error).toBe(
      "Address suggestions are temporarily rate limited. Please wait a moment and retry.",
    );
  });

  it("resolves place details on selection", async () => {
    const suggestion = createSuggestion();
    mockResolveDetails.mockResolvedValue({
      formattedAddress: "Detailed address",
      components: {},
    });

    const fieldRef = { current: null } as MutableRefObject<HTMLInputElement | null>;
    const onResolve = vi.fn();

    const { result } = renderHook(() =>
      useAddressAutocomplete<HTMLInputElement>({
        query: "exa",
        language: "en",
        countryBias: undefined,
        fieldRef,
        onResolve,
      }),
    );

    act(() => {
      result.current.handleSuggestionSelect(suggestion);
    });

    await waitFor(() => expect(mockResolveDetails).toHaveBeenCalledTimes(1));
    expect(onResolve).toHaveBeenCalledWith(
      "Detailed address",
      expect.objectContaining({
        suggestion,
        countryCode: undefined,
      }),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.lockedValue).toBe("Detailed address");

    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.lockedValue).toBeNull();
  });

  it("normalizes configuration errors", async () => {
    vi.useFakeTimers();

    mockAutocomplete.mockRejectedValueOnce(
      new Error("Address suggestions are not configured. Set GOOGLE_MAPS_API_KEY."),
    );

    const fieldRef = { current: null } as MutableRefObject<HTMLInputElement | null>;
    const onResolve = vi.fn();

    const { result, rerender } = renderHook(
      ({ query }) =>
        useAddressAutocomplete<HTMLInputElement>({
          query,
          language: "en",
          countryBias: undefined,
          fieldRef,
          onResolve,
        }),
      { initialProps: { query: "" } },
    );

    act(() => {
      result.current.handleFocus();
    });

    rerender({ query: "conf" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(260);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(
      "Address suggestions are unavailable. Ask your administrator to configure the Google Places API key.",
    );
  });
});
