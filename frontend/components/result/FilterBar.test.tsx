import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { track } from "@/lib/analytics";
import { FilterBar } from "./FilterBar";

test("지역 칩은 없고, URL에 필터가 없으면 방 기본 테마를 켜진 상태로 보여준다", () => {
  render(<FilterBar filter={{ regions: null, themes: null }} appliedThemes={["cafe"]} onChange={vi.fn()} />);
  for (const region of ["서울", "경기", "인천"]) {
    expect(screen.queryByRole("button", { name: region })).toBeNull();
  }
  expect(screen.getByRole("button", { name: "카페" })).toHaveAttribute("aria-pressed", "true");
});

test("테마를 고르면 그 테마, 하나뿐인 테마를 다시 누르면 any", async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <FilterBar filter={{ regions: null, themes: null }} appliedThemes={[]} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: null, themes: ["cafe"] });
  rerender(<FilterBar filter={{ regions: null, themes: null }} appliedThemes={["cafe"]} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: null, themes: "any" });
});

test("URL이 any면 방 테마가 있어도 꺼진 상태", () => {
  render(<FilterBar filter={{ regions: null, themes: "any" }} appliedThemes={[]} onChange={vi.fn()} />);
  for (const label of ["맛집", "카페", "술자리", "놀거리"]) {
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "false");
  }
});

test("예전 링크의 지역 필터는 테마를 바꿔도 그대로 넘긴다", async () => {
  const onChange = vi.fn();
  render(<FilterBar filter={{ regions: ["서울", "인천"], themes: null }} appliedThemes={[]} onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "맛집" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: ["서울", "인천"], themes: ["food"] });
});

test("테마를 바꾸면 id나 any로 통계를 남긴다", async () => {
  const { rerender } = render(<FilterBar filter={{ regions: null, themes: null }} appliedThemes={[]} onChange={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(track).toHaveBeenLastCalledWith("result_filter_changed", { kind: "theme", value: "cafe" });
  rerender(<FilterBar filter={{ regions: null, themes: null }} appliedThemes={["cafe"]} onChange={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "카페" }));
  expect(track).toHaveBeenLastCalledWith("result_filter_changed", { kind: "theme", value: "any" });
  expect(track).toHaveBeenCalledTimes(2);
});

test("켜진 테마가 있을 때 다른 테마를 누르면 둘 다 켜지고, 하나를 끄면 나머지가 남는다", async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <FilterBar filter={{ regions: null, themes: null }} appliedThemes={["drink"]} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "맛집" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: null, themes: ["food", "drink"] });
  expect(track).toHaveBeenLastCalledWith("result_filter_changed", { kind: "theme", value: "food,drink" });
  rerender(
    <FilterBar filter={{ regions: null, themes: ["food", "drink"] }} appliedThemes={["drink"]} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "술자리" }));
  expect(onChange).toHaveBeenLastCalledWith({ regions: null, themes: ["food"] });
});
