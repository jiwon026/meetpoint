import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ThemePicker } from "./ThemePicker";

test("네 가지 테마를 보여주고 고른 것을 넘긴다", async () => {
  const onChange = vi.fn();
  render(<ThemePicker value={[]} onChange={onChange} />);
  expect(screen.getAllByRole("button")).toHaveLength(4);
  await userEvent.click(screen.getByRole("button", { name: /술자리/ }));
  expect(onChange).toHaveBeenLastCalledWith(["drink"]);
});

test("여러 개를 고를 수 있고 누른 순서와 상관없이 정해진 순서로 넘긴다", async () => {
  const onChange = vi.fn();
  render(<ThemePicker value={["drink"]} onChange={onChange} />);
  expect(screen.getByRole("button", { name: /술자리/ })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: /맛집/ }));
  expect(onChange).toHaveBeenLastCalledWith(["food", "drink"]);
});

test("고른 테마를 다시 누르면 그것만 해제", async () => {
  const onChange = vi.fn();
  render(<ThemePicker value={["cafe", "play"]} onChange={onChange} />);
  const cafe = screen.getByRole("button", { name: /카페/ });
  expect(cafe).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(cafe);
  expect(onChange).toHaveBeenLastCalledWith(["play"]);
});
