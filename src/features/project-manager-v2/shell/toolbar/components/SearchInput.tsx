import { useDeferredValue, useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search projects",
  ariaLabel,
  className,
}: SearchInputProps) {
  const deferredValue = useDeferredValue(value.trimStart());
  const [buffer, setBuffer] = useState(deferredValue);

  useEffect(() => {
    setBuffer(deferredValue);
  }, [deferredValue]);

  return (
    <Input
      type="search"
      value={buffer}
      onChange={(event) => {
        const next = event.target.value;
        setBuffer(next);
        onChange(next);
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn("max-w-sm", className)}
      autoComplete="off"
    />
  );
}
