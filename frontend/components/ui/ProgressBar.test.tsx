import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ProgressBar } from "./ProgressBar";

test("추천 화면에서는 뒤로 버튼이 출발지 화면으로 간다", () => {
  render(<ProgressBar current={2} slug="abc123" />);
  expect(screen.getByRole("link", { name: "뒤로, 출발지" })).toHaveAttribute("href", "/r/abc123?add=1");
  expect(screen.getByText("추천").closest("li")).toHaveAttribute("aria-current", "step");
});

test("둘러보기 화면에서는 뒤로 버튼이 필터를 유지한 채 추천 화면으로 간다", () => {
  render(<ProgressBar current={3} slug="abc123" query="?theme=cafe" />);
  expect(screen.getByRole("link", { name: "뒤로, 추천" })).toHaveAttribute("href", "/r/abc123/result?theme=cafe");
});

test("단계 이름은 링크가 아니고, 첫 단계에는 뒤로 버튼이 없다", () => {
  const { rerender } = render(<ProgressBar current={3} slug="abc123" />);
  expect(screen.getAllByRole("link")).toHaveLength(1);
  rerender(<ProgressBar current={1} fill={0.5} slug="abc123" />);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});

test("막대는 지난 단계와 지금 단계를 채운 만큼 찬다", () => {
  const { rerender } = render(<ProgressBar current={1} fill={0.5} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "17");
  rerender(<ProgressBar current={2} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "67");
  rerender(<ProgressBar current={3} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  rerender(<ProgressBar current={1} fill={7} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
});
