import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEventHandler, MutableRefObject } from "react";

import { supabase } from "@/core/config";

import { generatePlacesSessionToken } from "./addressUtils";

interface AutocompleteResponse {
  readonly sessionToken: string | null;
  readonly suggestions: AddressSuggestion[];
}

interface PlaceDetailsResponse {
  readonly place: {
    readonly formattedAddress: string | null;
  } | null;
}

export interface AddressSuggestion {
  readonly id: string;
  readonly primaryText: string;
  readonly secondaryText: string | null;
  readonly structured: {
    readonly formattedAddress?: string | null;
    readonly placeId?: string | null;
    readonly resourceName?: string | null;
    readonly location?: {
      readonly latitude: number;
      readonly longitude: number;
    } | null;
    readonly [key: string]: unknown;
  };
  readonly resourceName: string | null;
  readonly types?: readonly string[];
  readonly distanceMeters: number | null;
}

interface UseAddressAutocompleteOptions {
  query: string;
  language: string;
  countryBias?: readonly string[];
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  onResolve: (address: string) => void;
}

interface UseAddressAutocompleteResult {
  suggestions: AddressSuggestion[];
  loading: boolean;
  error: string | null;
  clearError: () => void;
  focused: boolean;
  handleFocus: () => void;
  handleBlur: () => void;
  handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  handleSuggestionSelect: (suggestion: AddressSuggestion) => void;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  showPanel: boolean;
}

export function useAddressAutocomplete({
  query,
  language,
  countryBias,
  textareaRef,
  onResolve,
}: UseAddressAutocompleteOptions): UseAddressAutocompleteResult {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

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

  const runAutocomplete = useCallback(
    async (input: string, token: string) => {
      const { data, error: invokeError } = await supabase.functions.invoke<AutocompleteResponse>(
        "address-autocomplete",
        {
          body: {
            mode: "autocomplete",
            query: input,
            sessionToken: token,
            languageCode: language,
            countryBias: countryBias && countryBias.length > 0 ? [...countryBias] : undefined,
          },
        },
      );

      if (invokeError) {
        const details =
          "message" in invokeError && typeof invokeError.message === "string"
            ? invokeError.message
            : "Autocomplete failed.";
        throw new Error(details);
      }

      return {
        suggestions: data?.suggestions ?? [],
        sessionToken: data?.sessionToken ?? token,
      };
    },
    [countryBias, language],
  );

  const fetchPlaceDetails = useCallback(async (placeId: string) => {
    const token = sessionTokenRef.current ?? generatePlacesSessionToken();
    sessionTokenRef.current = token;
    const { data, error: invokeError } = await supabase.functions.invoke<PlaceDetailsResponse>(
      "address-autocomplete",
      {
        body: {
          mode: "place-details",
          placeId,
          sessionToken: token,
        },
      },
    );

    if (invokeError) {
      const details =
        "message" in invokeError && typeof invokeError.message === "string"
          ? invokeError.message
          : "Place details lookup failed.";
      throw new Error(details);
    }

    return data?.place?.formattedAddress ?? null;
  }, []);

  const countryBiasKey = countryBias?.join(",") ?? "";

  useEffect(() => {
    if (!focused) {
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
          const message =
            cause instanceof Error && cause.message ? cause.message : "Unable to fetch address suggestions.";
          setError(message);
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
  }, [countryBiasKey, focused, query, runAutocomplete]);

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

  const handleSuggestionSelect = useCallback(
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

      const identifier =
        (typeof suggestion.structured.placeId === "string" && suggestion.structured.placeId) ||
        suggestion.resourceName ||
        suggestion.id;

      let resolvedAddress = suggestion.structured.formattedAddress ?? suggestion.primaryText;

      if (identifier) {
        setLoading(true);
        try {
          const formatted = await fetchPlaceDetails(identifier);
          if (formatted) {
            resolvedAddress = formatted;
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
      setFocused(false);
      onResolve(resolvedAddress);

      requestAnimationFrame(() => {
        const element = textareaRef.current;
        if (element) {
          element.focus();
          const length = resolvedAddress.length;
          element.setSelectionRange(length, length);
        }
      });
    },
    [fetchPlaceDetails, onResolve, textareaRef],
  );

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
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
          void handleSuggestionSelect(suggestions[activeIndex]);
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

  return {
    suggestions,
    loading,
    error,
    clearError,
    focused,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handleSuggestionSelect,
    activeIndex,
    setActiveIndex,
    showPanel: focused && (suggestions.length > 0 || loading || Boolean(error)),
  };
}
