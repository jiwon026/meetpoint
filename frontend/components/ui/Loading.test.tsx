import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Loading, SlowNote } from "./Loading";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test("처음엔 불러오는 중, 4초 뒤에는 서버를 깨우는 중", () => {
  render(<Loading />);
  expect(screen.getByRole("status")).toHaveTextContent("불러오는 중이에요");
  act(() => vi.advanceTimersByTime(3999));
  expect(screen.getByRole("status")).toHaveTextContent("불러오는 중이에요");
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("status")).toHaveTextContent("서버를 깨우는 중이에요. 최대 1분쯤 걸려요.");
});

test("SlowNote는 4초 전에는 아무것도 보이지 않는다", () => {
  const { container } = render(<SlowNote />);
  expect(container).toBeEmptyDOMElement();
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.getByRole("status")).toHaveTextContent("서버를 깨우는 중이에요. 최대 1분쯤 걸려요.");
});
