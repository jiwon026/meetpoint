import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { LineBadge } from "./LineBadge";

test("숫자 노선은 줄여 쓰고 전체 이름은 title로 남긴다", () => {
  render(<LineBadge line="2호선" />);
  const badge = screen.getByTitle("2호선");
  expect(badge).toHaveTextContent("2");
  expect(badge).toHaveStyle({ backgroundColor: "#00a84d" });
});
