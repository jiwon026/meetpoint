import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { track } from "@/lib/analytics";
import { TryButton } from "./TryButton";

test("지금 해 보기는 첫 화면으로 보내고 어느 글의 어느 자리에서 눌렀는지 남긴다", async () => {
  render(<TryButton page="midpoint" place="middle" />);
  const link = screen.getByRole("link", { name: "지금 해 보기" });
  expect(link).toHaveAttribute("href", "/");
  await userEvent.click(link);
  expect(track).toHaveBeenCalledWith("guide_cta_clicked", { page: "midpoint", place: "middle" });
});
