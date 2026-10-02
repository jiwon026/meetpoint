import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { leg } from "@/lib/test/fixtures";
import { LegBars } from "./LegBars";

const LEGS = [
  leg({ participant_id: 1, nickname: "민수", minutes: 11, origin_station_name: "강남" }),
  leg({ participant_id: 2, nickname: "수진", minutes: 22, origin_station_name: "신림", via: "bus" }),
];

test("가장 오래 걸리는 사람만 강조하고 막대 길이는 비율대로", () => {
  render(<LegBars legs={LEGS} mine={[1]} />);
  const bars = screen.getAllByTestId("leg-bar");
  expect(bars[0]).toHaveStyle({ width: "50%" });
  expect(bars[1]).toHaveStyle({ width: "100%" });
  expect(bars[0]).toHaveClass("bg-primary-soft");
  expect(bars[1]).toHaveClass("bg-accent");
  expect(screen.getByText("약 22분")).toHaveClass("text-accent");
});

test("내가 넣은 사람과 버스 구간을 표시한다", () => {
  render(<LegBars legs={LEGS} mine={[1]} />);
  expect(screen.getByText("나")).toBeInTheDocument();
  expect(screen.getByText("신림, 버스 15분 포함")).toBeInTheDocument();
});
