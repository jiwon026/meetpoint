import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RegionChips } from "./RegionChips";

test("누르면 켜고 끈 결과를 넘긴다", async () => {
  const onChange = vi.fn();
  render(<RegionChips value={["서울", "경기"]} onChange={onChange} />);
  expect(screen.getByRole("button", { name: "서울" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "인천" })).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(screen.getByRole("button", { name: "경기" }));
  expect(onChange).toHaveBeenLastCalledWith(["서울"]);
  await userEvent.click(screen.getByRole("button", { name: "인천" }));
  expect(onChange).toHaveBeenLastCalledWith(["서울", "경기", "인천"]);
});

test("마지막 하나는 끄지 않는다", async () => {
  const onChange = vi.fn();
  render(<RegionChips value={["서울"]} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "서울" }));
  expect(onChange).toHaveBeenLastCalledWith(["서울"]);
});
