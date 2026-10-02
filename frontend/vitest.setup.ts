import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./lib/test/server";

// 라우터 없이도 링크의 href를 검사할 수 있게 next/link를 평범한 a 태그로 바꾼다.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  window.localStorage.clear();
});
afterAll(() => server.close());
