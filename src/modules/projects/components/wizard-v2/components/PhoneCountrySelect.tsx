import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/class-names";
import type { CountryCode } from "libphonenumber-js";

import type { PhoneCountryMeta } from "./phoneUtils";

type PhoneCountrySelectProps = {
  readonly value: CountryCode;
  readonly options: readonly PhoneCountryMeta[];
  readonly currentLabel: PhoneCountryMeta;
  readonly disabled?: boolean;
  onChange: (next: CountryCode) => void;
};

export function PhoneCountrySelect({ value, options, currentLabel, disabled, onChange }: PhoneCountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return options;
    }
    const needle = query.trim().toLowerCase();
    return options.filter((option) => {
      return (
        option.name.toLowerCase().includes(needle) ||
        option.code.toLowerCase().includes(needle) ||
        (option.callingCode && `+${option.callingCode}`.includes(needle))
      );
    });
  }, [options, query]);

  const handleSelect = (code: CountryCode) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, code: CountryCode) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect(code);
    }
  };

  useEffect(() => {
    if (!open && query) {
      setQuery("");
    }
  }, [open, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled && next) return;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Select country ${currentLabel.callingCode ? `+${currentLabel.callingCode}` : ""} ${currentLabel.name}`}
          title={currentLabel.name}
          className={cn("wizard-v2-phone-trigger", disabled && "wizard-v2-phone-trigger--disabled")}
        >
          <span className="wizard-v2-phone-trigger-info">
            <span className="wizard-v2-phone-trigger-code">
              {currentLabel.callingCode ? `+${currentLabel.callingCode}` : "Select"}
            </span>
            <span className="wizard-v2-phone-trigger-name">{currentLabel.name}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="wizard-v2-phone-popover" sideOffset={6} align="start">
        <div className="wizard-v2-phone-search">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search country or code"
            autoComplete="off"
            autoFocus
          />
        </div>
        <div role="listbox" className="wizard-v2-phone-options">
          {filtered.length === 0 ? (
            <p className="wizard-v2-phone-empty">No matches found.</p>
          ) : (
            filtered.map((option) => {
              const isActive = option.code === value;
              return (
                <button
                  key={option.code}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={cn("wizard-v2-phone-option", isActive && "wizard-v2-phone-option--active")}
                  onClick={() => handleSelect(option.code)}
                  onKeyDown={(event) => handleKeyDown(event, option.code)}
                >
                  <span className="wizard-v2-phone-option-flag" aria-hidden="true">
                    {option.flag}
                  </span>
                  <span className="wizard-v2-phone-option-body">
                    <span className="wizard-v2-phone-option-name">{option.name}</span>
                    <span className="wizard-v2-phone-option-code">
                      {option.callingCode ? `+${option.callingCode}` : option.code}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
