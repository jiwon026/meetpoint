import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Chip } from "./Chip";

test("선택 상태를 aria-pressed로 알리고 누르면 onClick", async () => {
  const onClick = vi.fn();
  render(<Chip selected onClick={onClick}>서울</Chip>);
  const chip = screen.getByRole("button", { name: "서울" });
  expect(chip).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(chip);
  expect(onClick).toHaveBeenCalledOnce();
});
