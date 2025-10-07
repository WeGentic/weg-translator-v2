import { useEffect, useMemo, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number = 250): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), Math.max(0, delayMs));
    return () => {
      window.clearTimeout(handle);
    };
  }, [value, delayMs]);

  return useMemo(() => debounced, [debounced]);
}
