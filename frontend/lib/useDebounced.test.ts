import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useDebounced } from "./useDebounced";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("마지막 값만 지연 후 반영한다", () => {
  const { result, rerender } = renderHook(({ value }) => useDebounced(value, 300), {
    initialProps: { value: "강" },
  });
  rerender({ value: "강남" });
  rerender({ value: "강남역" });
  expect(result.current).toBe("강");
  act(() => vi.advanceTimersByTime(299));
  expect(result.current).toBe("강");
  act(() => vi.advanceTimersByTime(1));
  expect(result.current).toBe("강남역");
});
