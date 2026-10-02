import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { FilterBar } from "./FilterBar";

const ALL = ["서울", "경기", "인천"];

test("URL에 필터가 없으면 적용된 값(방 기본값)을 켜진 상태로 보여준다", () => {
  render(
    <FilterBar filter={{ regions: null, theme: null }} appliedRegions={["서울", "경기"]} appliedTheme="cafe" onChange={vi.fn()} />,
  );
  expect(screen.getByRole("button", { name: "서울" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "인천" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "카페" })).toHaveAttribute("aria-pressed", "true");
});

test("지역을 끄면 남은 지역을 넘기고 테마는 건드리지 않는다", async () => {
  const onChange = vi.fn();
  render(<FilterBar filter={{ regions: null, theme: null }} appliedRegions={ALL} appliedTheme={null} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "경기" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: ["서울", "인천"], theme: null });
});

test("URL 필터가 적용된 값보다 우선한다 (응답이 오기 전에 연달아 눌러도 맞게)", async () => {
  const onChange = vi.fn();
  render(
    <FilterBar filter={{ regions: ["서울", "인천"], theme: null }} appliedRegions={ALL} appliedTheme={null} onChange={onChange} />,
  );
  expect(screen.getByRole("button", { name: "경기" })).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(screen.getByRole("button", { name: "인천" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: ["서울"], theme: null });
});

test("테마를 고르면 그 테마, 켜진 테마를 다시 누르면 any", async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <FilterBar filter={{ regions: null, theme: null }} appliedRegions={ALL} appliedTheme={null} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: null, theme: "cafe" });
  rerender(
    <FilterBar filter={{ regions: null, theme: null }} appliedRegions={ALL} appliedTheme="cafe" onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: null, theme: "any" });
});

test("URL이 any면 방 테마가 있어도 꺼진 상태", () => {
  render(<FilterBar filter={{ regions: null, theme: "any" }} appliedRegions={ALL} appliedTheme={null} onChange={vi.fn()} />);
  for (const label of ["맛집", "카페", "술자리", "놀거리"]) {
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "false");
  }
});
