import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { track } from "./lib/analytics";
import { server } from "./lib/test/server";

// 통계 모듈은 테스트에서 언제나 가짜다. 실제 SDK는 어디서도 불리지 않고, 화면 테스트는 track 호출을 검사한다.
vi.mock("@/lib/analytics", () => ({ initAnalytics: vi.fn(), track: vi.fn(), setTrackingPaused: vi.fn() }));

// 라우터 없이도 링크의 href를 검사할 수 있게 next/link를 평범한 a 태그로 바꾼다.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.mocked(track).mockClear();
  window.localStorage.clear();
});
afterAll(() => server.close());
