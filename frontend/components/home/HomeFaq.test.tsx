import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { HomeFaq } from "./HomeFaq";

test("자주 묻는 질문 다섯 개를 소제목으로 보여준다", () => {
  render(<HomeFaq />);
  expect(screen.getByRole("heading", { name: "자주 묻는 질문" })).toBeInTheDocument();
  expect(screen.getAllByRole("group")).toHaveLength(5);
  expect(screen.getByText("약속장소 중간지점은 어떻게 정하나요?")).toBeInTheDocument();
});

test("답은 결론 문장부터 굵게 쓴다", () => {
  render(<HomeFaq />);
  expect(screen.getByText("한 약속에 20명까지예요.").tagName).toBe("STRONG");
});
