import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { StepIndicator } from "./StepIndicator";

test("지나온 단계만 링크이고 현재 단계를 표시한다", () => {
  render(<StepIndicator current={3} slug="abc123" />);
  expect(screen.getByRole("link", { name: "1 방 만들기" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "2 참여" })).toHaveAttribute("href", "/r/abc123?add=1");
  expect(screen.queryByRole("link", { name: "3 추천" })).toBeNull();
  expect(screen.queryByRole("link", { name: "4 둘러보기" })).toBeNull();
  expect(screen.getByText("3 추천").closest("li")).toHaveAttribute("aria-current", "step");
});

test("추천 단계 링크는 필터 쿼리를 유지한다", () => {
  render(<StepIndicator current={4} slug="abc123" query="?theme=cafe" />);
  expect(screen.getByRole("link", { name: "3 추천" })).toHaveAttribute("href", "/r/abc123/result?theme=cafe");
});

test("방이 없는 첫 화면에는 링크가 없다", () => {
  render(<StepIndicator current={1} />);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});
