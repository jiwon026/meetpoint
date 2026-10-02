import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ThemePicker } from "./ThemePicker";

test("네 가지 테마를 보여주고 고른 것을 넘긴다", async () => {
  const onChange = vi.fn();
  render(<ThemePicker value={null} onChange={onChange} />);
  expect(screen.getAllByRole("button")).toHaveLength(4);
  await userEvent.click(screen.getByRole("button", { name: /술자리/ }));
  expect(onChange).toHaveBeenLastCalledWith("drink");
});

test("고른 테마를 다시 누르면 해제", async () => {
  const onChange = vi.fn();
  render(<ThemePicker value="cafe" onChange={onChange} />);
  const cafe = screen.getByRole("button", { name: /카페/ });
  expect(cafe).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(cafe);
  expect(onChange).toHaveBeenLastCalledWith(null);
});
