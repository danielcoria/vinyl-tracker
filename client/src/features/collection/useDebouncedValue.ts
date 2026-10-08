// ============================================================================
// useDebouncedValue.ts: WAIT UNTIL SOMEONE STOPS TYPING
//
// Returns `value`, but only after it has stopped changing for `delayMs`.
// The search box uses it so we ask the server once when you pause, instead of
// once for every letter you type.
// ============================================================================

import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  // useEffect runs code after the screen updates. Here: start a timer every
  // time `value` changes. If it changes again first, the old timer is cancelled.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
