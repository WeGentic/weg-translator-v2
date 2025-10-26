import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEventHandler, MutableRefObject } from "react";

import {
  autocompleteAddress,
  resolveAddressDetails,
  type AddressSuggestion,
  type StructuredSuggestion,
} from "@/core/ipc/places";

export type { AddressSuggestion } from "@/core/ipc/places";

import { generatePlacesSessionToken } from "./addressUtils";

type AddressFieldElement = HTMLInputElement | HTMLTextAreaElement;

export interface ResolvedAddressContext {
  suggestion: AddressSuggestion;
  countryCode?: string;
}

interface ResolvedAddressResult {
  formattedAddress: string | null;
  countryCode?: string;
}

interface UseAddressAutocompleteOptions<T extends AddressFieldElement> {
  query: string;
  language: string;
  countryBias?: readonly string[];
  fieldRef: MutableRefObject<T | null>;
  onResolve: (address: string, context?: ResolvedAddressContext) => void;
}

interface UseAddressAutocompleteResult<T extends AddressFieldElement> {
  suggestions: AddressSuggestion[];
  loading: boolean;
  error: string | null;
  lockedValue: string | null;
  clearError: () => void;
  focused: boolean;
  handleFocus: () => void;
  handleBlur: () => void;
  handleKeyDown: KeyboardEventHandler<T>;
  handleSuggestionSelect: (suggestion: AddressSuggestion) => void;
  clearSelection: () => void;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  showPanel: boolean;
}

export function useAddressAutocomplete<T extends AddressFieldElement>({
  query,
  language,
  countryBias,
  fieldRef,
  onResolve,
}: UseAddressAutocompleteOptions<T>): UseAddressAutocompleteResult<T> {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [lockedValue, setLockedValue] = useState<string | null>(null);

  const searchTimeoutRef = useRef<number | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const clearTimers = () => {
    if (searchTimeoutRef.current !== null) {
      window.clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  };

  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (typeof error === "object" && error !== null && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }
    return fallback;
  }, []);

  const normalizePlacesError = useCallback((message: string) => {
    const normalized = message.trim();
    if (!normalized.length) {
      return "Address suggestions are temporarily unavailable. Try again in a few moments.";
    }

    if (
      /temporarily rate limited/i.test(normalized) ||
      /quota was reached/i.test(normalized) ||
      /too many requests/i.test(normalized) ||
      /quota exceeded/i.test(normalized)
    ) {
      return "Address suggestions are temporarily rate limited. Please wait a moment and retry.";
    }

    if (/not configured/i.test(normalized)) {
      return "Address suggestions are unavailable. Ask your administrator to configure the Google Places API key.";
    }

    return normalized;
  }, []);

  const runAutocomplete = useCallback(
    async (input: string, token: string) => {
      try {
        const response = await autocompleteAddress({
          query: input,
          sessionToken: token,
          language,
          countryBias,
        });

        return {
          suggestions: response.suggestions,
          sessionToken: response.sessionToken ?? token,
        };
      } catch (cause) {
        throw new Error(getErrorMessage(cause, "Autocomplete failed."));
      }
    },
    [countryBias, language, getErrorMessage],
  );

  const fetchPlaceDetails = useCallback(async (suggestion: AddressSuggestion) => {
    const token = sessionTokenRef.current ?? generatePlacesSessionToken();
    sessionTokenRef.current = token;
    const reference = suggestion.resourceName ?? suggestion.structured?.placeId ?? suggestion.id;
    if (!reference) {
      return null;
    }

    const payload = {
      placeId:
        suggestion.structured?.placeId ?? (reference.startsWith("places/") ? undefined : reference),
      resourceName:
        suggestion.resourceName ?? (reference.startsWith("places/") ? reference : undefined),
      sessionToken: token,
    };

    try {
      const result = await resolveAddressDetails(payload);
      if (!result) {
        return null;
      }
      return {
        formattedAddress: result.formattedAddress ?? null,
        countryCode: result.components.countryCode ?? result.components.country ?? undefined,
      } satisfies ResolvedAddressResult;
    } catch (cause) {
      throw new Error(getErrorMessage(cause, "Place details lookup failed."));
    }
  }, [getErrorMessage]);

  const countryBiasKey = countryBias?.join(",") ?? "";

  useEffect(() => {
    if (!focused || lockedValue) {
      setSuggestions([]);
      setActiveIndex(-1);
      sessionTokenRef.current = null;
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setActiveIndex(-1);
      setError(null);
      sessionTokenRef.current = null;
      return;
    }

    clearTimers();

    searchTimeoutRef.current = window.setTimeout(() => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      const token = sessionTokenRef.current ?? generatePlacesSessionToken();
      sessionTokenRef.current = token;

      setLoading(true);
      setError(null);

      void runAutocomplete(trimmed, token)
        .then(({ suggestions: nextSuggestions, sessionToken }) => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          sessionTokenRef.current = sessionToken ?? token;
          setSuggestions(nextSuggestions);
          setActiveIndex(nextSuggestions.length > 0 ? 0 : -1);
        })
        .catch((cause: unknown) => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          const rawMessage =
            cause instanceof Error && cause.message
              ? cause.message
              : "Unable to fetch address suggestions.";
          const friendlyMessage = normalizePlacesError(rawMessage);
          if (process.env.NODE_ENV !== "production") {
            console.error("[autocomplete] request failed:", rawMessage);
          }
          setError(friendlyMessage);
          setSuggestions([]);
          setActiveIndex(-1);
        })
        .finally(() => {
          if (requestIdRef.current === requestId) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      clearTimers();
    };
  }, [countryBiasKey, focused, lockedValue, query, runAutocomplete, normalizePlacesError]);

  useEffect(() => {
    return () => {
      clearTimers();
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = window.setTimeout(() => {
      setFocused(false);
      setSuggestions([]);
      setActiveIndex(-1);
      blurTimeoutRef.current = null;
    }, 150);
  }, []);

  const handleSuggestionSelectInternal = useCallback(
    async (suggestion: AddressSuggestion) => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      requestIdRef.current += 1;
      clearTimers();

      setSuggestions([]);
      setActiveIndex(-1);
      setError(null);

      const structured =
        suggestion.structured ?? ({ components: {} } satisfies StructuredSuggestion);
      let resolvedAddress =
        structured.formattedAddress ?? suggestion.primaryText ?? suggestion.secondaryText ?? "";
      let resolvedCountryCode =
        structured.components?.countryCode ?? structured.components?.country ?? undefined;

      const hasResolvableIdentifier =
        (typeof structured.placeId === "string" && structured.placeId.length > 0) ||
        (typeof suggestion.resourceName === "string" && suggestion.resourceName.length > 0) ||
        suggestion.id.startsWith("places/");

      if (hasResolvableIdentifier) {
        setLoading(true);
        try {
          const details = await fetchPlaceDetails(suggestion);
          if (details) {
            if (details.formattedAddress) {
              resolvedAddress = details.formattedAddress;
            }
            if (details.countryCode) {
              resolvedCountryCode = details.countryCode;
            }
          }
        } catch (cause) {
          const message =
            cause instanceof Error && cause.message ? cause.message : "Unable to resolve address details.";
          setError(message);
        } finally {
          setLoading(false);
        }
      }

      sessionTokenRef.current = null;
      setLockedValue(resolvedAddress);
      setFocused(false);
      onResolve(resolvedAddress, {
        suggestion,
        countryCode: resolvedCountryCode?.toUpperCase(),
      });

      requestAnimationFrame(() => {
        const element = fieldRef.current;
        if (element) {
          element.focus();
          const length = resolvedAddress.length;
          element.setSelectionRange(length, length);
        }
      });
    },
    [fetchPlaceDetails, onResolve, fieldRef],
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: AddressSuggestion) => {
      void handleSuggestionSelectInternal(suggestion);
    },
    [handleSuggestionSelectInternal],
  );

  const handleKeyDown: KeyboardEventHandler<AddressFieldElement> = useCallback(
    (event) => {
      if (lockedValue) {
        return;
      }
      if (suggestions.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => {
          const next = prev + 1;
          return next >= suggestions.length ? 0 : next;
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => {
          if (prev <= 0) {
            return suggestions.length - 1;
          }
          return prev - 1;
        });
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          event.preventDefault();
          handleSuggestionSelect(suggestions[activeIndex]);
        }
      }

      if (event.key === "Escape") {
        setSuggestions([]);
        setActiveIndex(-1);
        sessionTokenRef.current = null;
      }
    },
    [activeIndex, handleSuggestionSelect, suggestions],
  );

  const clearError = useCallback(() => setError(null), []);

  const clearSelection = useCallback(() => {
    setLockedValue(null);
    setSuggestions([]);
    setActiveIndex(-1);
    setError(null);
    sessionTokenRef.current = null;
  }, []);

  return {
    suggestions,
    loading,
    error,
    lockedValue,
    clearError,
    focused,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handleSuggestionSelect,
    clearSelection,
    activeIndex,
    setActiveIndex,
    showPanel: focused && !lockedValue && (suggestions.length > 0 || loading || Boolean(error)),
  };
}
