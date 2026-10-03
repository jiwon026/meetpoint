import { useEffect, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "./constants";

export function useDebounced<T>(value: T, ms: number = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
