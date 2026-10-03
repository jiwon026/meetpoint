import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { participant } from "@/lib/test/fixtures";
import { Roster } from "./Roster";

const PEOPLE = [
  participant({ id: 1, nickname: "민수", nearest_station_name: "강남" }),
  participant({ id: 2, nickname: "수진", nearest_station_name: "신림", via: "bus" }),
  participant({ id: 3, nickname: "현우", nearest_station_name: "사당", active: false }),
];

test("참여와 빠진 사람을 나눠 보여준다", () => {
  render(<Roster participants={PEOPLE} mine={[1]} busyId={null} onSetActive={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "참여 2명, 빠진 사람 1명" })).toBeInTheDocument();
  expect(screen.getByText("내가 등록")).toBeInTheDocument();
  expect(screen.getByText("신림 출발, 버스 15분 포함")).toBeInTheDocument();
  const away = screen.getByRole("heading", { name: "빠진 사람" }).parentElement as HTMLElement;
  expect(within(away).getByText("현우")).toBeInTheDocument();
});

test("빠진 사람이 없으면 참여 인원만 쓴다", () => {
  render(<Roster participants={PEOPLE.slice(0, 2)} mine={[]} busyId={null} onSetActive={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "참여 2명" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "빠진 사람" })).toBeNull();
});

test("빼기와 다시 넣기는 대상과 바꿀 상태를 넘긴다", async () => {
  const onSetActive = vi.fn();
  render(<Roster participants={PEOPLE} mine={[]} busyId={null} onSetActive={onSetActive} />);
  await userEvent.click(screen.getByRole("button", { name: "민수 빼기" }));
  expect(onSetActive).toHaveBeenLastCalledWith(PEOPLE[0], false);
  await userEvent.click(screen.getByRole("button", { name: "현우 다시 넣기" }));
  expect(onSetActive).toHaveBeenLastCalledWith(PEOPLE[2], true);
});

test("아무도 없으면 안내 문구", () => {
  render(<Roster participants={[]} mine={[]} busyId={null} onSetActive={vi.fn()} />);
  expect(screen.getByText("아직 아무도 없어요. 첫 번째로 출발지를 넣어보세요.")).toBeInTheDocument();
});
