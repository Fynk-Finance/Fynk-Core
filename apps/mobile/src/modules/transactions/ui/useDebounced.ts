// The value after it stopped changing for `ms`: the search runs once the person pauses typing.
import { useEffect, useState } from 'react';

export const SEARCH_DEBOUNCE_MS = 250;

export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
