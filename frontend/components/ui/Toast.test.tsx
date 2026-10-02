import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function Trigger() {
  const toast = useToast();
  return <button onClick={() => toast("링크를 복사했어요")}>알림</button>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("문구를 띄우고 잠시 뒤 지운다", () => {
  render(<ToastProvider><Trigger /></ToastProvider>);
  act(() => screen.getByRole("button", { name: "알림" }).click());
  expect(screen.getByRole("status")).toHaveTextContent("링크를 복사했어요");
  act(() => vi.advanceTimersByTime(2500));
  expect(screen.queryByRole("status")).toBeNull();
});
