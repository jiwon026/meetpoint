import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { track } from "@/lib/analytics";
import { FilterBar } from "./FilterBar";

const ALL = ["서울", "경기", "인천"];

test("URL에 필터가 없으면 적용된 값(방 기본값)을 켜진 상태로 보여준다", () => {
  render(
    <FilterBar filter={{ regions: null, themes: null }} appliedRegions={["서울", "경기"]} appliedThemes={["cafe"]} onChange={vi.fn()} />,
  );
  expect(screen.getByRole("button", { name: "서울" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "인천" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "카페" })).toHaveAttribute("aria-pressed", "true");
});

test("지역을 끄면 남은 지역을 넘기고 테마는 건드리지 않는다", async () => {
  const onChange = vi.fn();
  render(<FilterBar filter={{ regions: null, themes: null }} appliedRegions={ALL} appliedThemes={[]} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "경기" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: ["서울", "인천"], themes: null });
});

test("URL 필터가 적용된 값보다 우선한다 (응답이 오기 전에 연달아 눌러도 맞게)", async () => {
  const onChange = vi.fn();
  render(
    <FilterBar filter={{ regions: ["서울", "인천"], themes: null }} appliedRegions={ALL} appliedThemes={[]} onChange={onChange} />,
  );
  expect(screen.getByRole("button", { name: "경기" })).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(screen.getByRole("button", { name: "인천" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: ["서울"], themes: null });
});

test("테마를 고르면 그 테마, 하나뿐인 테마를 다시 누르면 any", async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <FilterBar filter={{ regions: null, themes: null }} appliedRegions={ALL} appliedThemes={[]} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: null, themes: ["cafe"] });
  rerender(
    <FilterBar filter={{ regions: null, themes: null }} appliedRegions={ALL} appliedThemes={["cafe"]} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: null, themes: "any" });
});

test("URL이 any면 방 테마가 있어도 꺼진 상태", () => {
  render(<FilterBar filter={{ regions: null, themes: "any" }} appliedRegions={ALL} appliedThemes={[]} onChange={vi.fn()} />);
  for (const label of ["맛집", "카페", "술자리", "놀거리"]) {
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "false");
  }
});

test("필터를 바꾸면 지역은 쉼표로 이은 목록, 테마는 id나 any로 통계를 남긴다", async () => {
  const { rerender } = render(
    <FilterBar filter={{ regions: null, themes: null }} appliedRegions={ALL} appliedThemes={[]} onChange={vi.fn()} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "경기" }));
  expect(track).toHaveBeenLastCalledWith("result_filter_changed", { kind: "region", value: "서울,인천" });
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(track).toHaveBeenLastCalledWith("result_filter_changed", { kind: "theme", value: "cafe" });
  rerender(
    <FilterBar filter={{ regions: null, themes: null }} appliedRegions={ALL} appliedThemes={["cafe"]} onChange={vi.fn()} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(track).toHaveBeenLastCalledWith("result_filter_changed", { kind: "theme", value: "any" });
  expect(track).toHaveBeenCalledTimes(3);
});

test("켜진 테마가 있을 때 다른 테마를 누르면 둘 다 켜지고, 하나를 끄면 나머지가 남는다", async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <FilterBar filter={{ regions: null, themes: null }} appliedRegions={ALL} appliedThemes={["drink"]} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "맛집" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: null, themes: ["food", "drink"] });
  expect(track).toHaveBeenLastCalledWith("result_filter_changed", { kind: "theme", value: "food,drink" });
  rerender(
    <FilterBar filter={{ regions: null, themes: ["food", "drink"] }} appliedRegions={ALL} appliedThemes={["drink"]} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "술자리" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: null, themes: ["food"] });
});
