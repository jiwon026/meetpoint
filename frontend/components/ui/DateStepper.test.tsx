import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { DateStepper } from "./DateStepper";

const RANGE = { min: "2026-10-14", max: "2027-10-14" };
const PICKER = "약속 날짜 10월 21일 (수), 달력에서 고르기";

test("날짜를 요일과 함께 보여주고 하루씩 옮긴다", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<DateStepper value="2026-10-21" {...RANGE} onChange={onChange} />);
  expect(screen.getByText("10월 21일 (수)")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "하루 뒤" }));
  await user.click(screen.getByRole("button", { name: "하루 전" }));
  expect(onChange.mock.calls).toEqual([["2026-10-22"], ["2026-10-20"]]);
});

test("오늘보다 앞이나 1년 뒤로는 못 간다", () => {
  const { rerender } = render(<DateStepper value="2026-10-14" {...RANGE} onChange={vi.fn()} />);
  expect(screen.getByRole("button", { name: "하루 전" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "하루 뒤" })).toBeEnabled();
  rerender(<DateStepper value="2027-10-14" {...RANGE} onChange={vi.fn()} />);
  expect(screen.getByRole("button", { name: "하루 뒤" })).toBeDisabled();
});

test("가운데 날짜 칸에서 고른 날짜는 범위 안일 때만 받는다", () => {
  const onChange = vi.fn();
  render(<DateStepper value="2026-10-21" {...RANGE} onChange={onChange} />);
  const input = screen.getByLabelText(PICKER);
  expect(input).toHaveValue("2026-10-21");
  fireEvent.change(input, { target: { value: "2026-11-03" } });
  fireEvent.change(input, { target: { value: "2026-10-01" } });
  fireEvent.change(input, { target: { value: "" } });
  expect(onChange.mock.calls).toEqual([["2026-11-03"]]);
});

test("가운데를 누르면 달력을 열고, 못 여는 브라우저에서도 오류 없이 넘어간다", async () => {
  const user = userEvent.setup();
  render(<DateStepper value="2026-10-21" {...RANGE} onChange={vi.fn()} />);
  const input = screen.getByLabelText<HTMLInputElement>(PICKER);
  input.showPicker = vi.fn();
  await user.click(input);
  expect(input.showPicker).toHaveBeenCalledOnce();
  input.showPicker = () => {
    throw new Error("not allowed");
  };
  await user.click(input);
});
