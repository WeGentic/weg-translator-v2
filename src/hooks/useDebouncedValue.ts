import { useEffect, useMemo, useRef, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number = 250): T {
  const [debounced, setDebounced] = useState<T>(value);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const handle = window.setTimeout(() => setDebounced(value), Math.max(0, delayMs));
    timerRef.current = handle;
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, delayMs]);

  return useMemo(() => debounced, [debounced]);
}

