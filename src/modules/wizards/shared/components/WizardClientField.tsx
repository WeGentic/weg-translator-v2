import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Loader2 } from "lucide-react";

import type { ClientRecord } from "@/shared/types/database";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/class-names";

interface WizardClientFieldProps {
  inputId: string;
  value: string;
  options: ClientRecord[];
  onValueChange: (nextValue: string) => void;
  onSelect: (client: ClientRecord) => void;
  onResetSelection: () => void;
  onCreateRequested: (initialName: string) => void;
  selectedClientUuid: string | null;
  isLoading: boolean;
  errorMessage: string | null;
}

export function WizardClientField({
  inputId,
  value,
  options,
  onValueChange,
  onSelect,
  onResetSelection,
  onCreateRequested,
  selectedClientUuid,
  isLoading,
  errorMessage,
}: WizardClientFieldProps) {
  const SEARCH_THRESHOLD = 3;
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const normalizedValue = value.trim().toLowerCase();
  const hasSearchQuery = normalizedValue.length >= SEARCH_THRESHOLD;

  const filteredOptions = useMemo(() => {
    if (!hasSearchQuery) {
      return [];
    }
    return options.filter((option) => option.name.toLowerCase().includes(normalizedValue));
  }, [hasSearchQuery, normalizedValue, options]);

  const hasExactMatch = useMemo(() => {
    if (!hasSearchQuery) {
      return false;
    }
    return options.some((option) => option.name.toLowerCase() === normalizedValue);
  }, [hasSearchQuery, normalizedValue, options]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  const handleValueChange = (next: string) => {
    onValueChange(next);
    onResetSelection();
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleSelect = (client: ClientRecord) => {
    onSelect(client);
    setIsOpen(false);
    setHighlightedIndex(null);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Tab") {
      setIsOpen(false);
      setHighlightedIndex(null);
      return;
    }

    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(true);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filteredOptions.length === 0) {
        return;
      }
      setHighlightedIndex((current) => {
        if (current === null) {
          return 0;
        }
        return current + 1 >= filteredOptions.length ? 0 : current + 1;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filteredOptions.length === 0) {
        return;
      }
      setHighlightedIndex((current) => {
        if (current === null) {
          return filteredOptions.length - 1;
        }
        return current - 1 < 0 ? filteredOptions.length - 1 : current - 1;
      });
      return;
    }

    if (event.key === "Enter") {
      const safeIndex =
        highlightedIndex !== null && highlightedIndex < filteredOptions.length ? highlightedIndex : null;
      if (safeIndex === null || filteredOptions.length === 0) {
        return;
      }
      event.preventDefault();
      const highlighted = filteredOptions[safeIndex];
      if (highlighted) {
        handleSelect(highlighted);
      }
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(null);
      return;
    }
  };

  const showCreateHint = hasSearchQuery && !hasExactMatch;
  const activeIndex =
    isOpen && highlightedIndex !== null && highlightedIndex < filteredOptions.length ? highlightedIndex : null;

  const activeDescendantId = activeIndex !== null ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div className="wizard-v2-autocomplete" ref={containerRef}>
      <Input
        id={inputId}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendantId}
        value={value}
        onChange={(event) => handleValueChange(event.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search clients…"
        className={cn("wizard-v2-input", "wizard-v2-control")}
        autoComplete="off"
      />

      {isOpen ? (
        <div className="wizard-v2-autocomplete-menu" role="listbox" id={listboxId}>
          {isLoading ? (
            <div className="wizard-v2-autocomplete-status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Loading clients…</span>
            </div>
          ) : hasSearchQuery ? (
            filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const isHighlighted = index === activeIndex;
                const isSelected = option.clientUuid === selectedClientUuid;
                return (
                  <button
                    type="button"
                    key={option.clientUuid}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "wizard-v2-autocomplete-item",
                      isHighlighted && "is-highlighted",
                      isSelected && "is-selected",
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseLeave={() => setHighlightedIndex(null)}
                    onClick={() => handleSelect(option)}
                  >
                    <span className="wizard-v2-autocomplete-primary">{option.name}</span>
                    {option.email ? <span className="wizard-v2-autocomplete-secondary">{option.email}</span> : null}
                  </button>
                );
              })
            ) : (
              <div className="wizard-v2-autocomplete-status">
                No saved clients match yet. Use the hint below to add one.
              </div>
            )
          ) : (
            <div className="wizard-v2-autocomplete-status">Start typing at least three characters to search.</div>
          )}
        </div>
      ) : null}

      {errorMessage ? (
        <p className="wizard-v2-autocomplete-error" role="status">
          {errorMessage}
        </p>
      ) : null}

      {showCreateHint ? (
        <button
          type="button"
          className="wizard-v2-client-hint"
          onClick={() => onCreateRequested(value.trim())}
        >
          Can&apos;t find &quot;{value.trim()}&quot;? Add a new client.
        </button>
      ) : null}
    </div>
  );
}
