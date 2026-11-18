import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { initAnalytics, track } from "@/lib/analytics";
import { GuideViewed } from "./GuideViewed";

test("가이드 글을 열면 통계를 먼저 시작한 뒤 어느 글인지 한 번 남긴다", () => {
  const { rerender } = render(<GuideViewed page="midpoint" />);
  rerender(<GuideViewed page="midpoint" />);
  expect(track).toHaveBeenCalledTimes(1);
  expect(track).toHaveBeenCalledWith("guide_viewed", { page: "midpoint" });
  // 검색에서 바로 들어오면 Providers의 초기화보다 이 효과가 먼저 돈다. 초기화를 먼저 불러야 이벤트가 버려지지 않는다.
  expect(vi.mocked(initAnalytics).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(track).mock.invocationCallOrder[0],
  );
});
