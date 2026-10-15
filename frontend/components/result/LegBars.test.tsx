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

test("여러 명을 내가 넣었으면 누구에게도 나 표시를 붙이지 않는다", () => {
  render(<LegBars legs={LEGS} mine={[1, 2]} />);
  expect(screen.queryByText("나")).toBeNull();
});

test("뺐다가 다시 넣어 예전 id가 남아 있어도 지금 있는 한 명에게 나 표시를 붙인다", () => {
  render(<LegBars legs={LEGS} mine={[99, 1]} />);
  expect(screen.getByText("나")).toBeInTheDocument();
});

const DESTINATION = { name: "양재", lat: 37.4841, lng: 127.0346 };

test("목적지를 주면 사람마다 카카오맵 대중교통 길찾기 링크를 단다", () => {
  render(<LegBars legs={LEGS} mine={[]} destination={DESTINATION} />);
  const link = screen.getByRole("link", { name: "민수 길찾기" });
  expect(link).toHaveAttribute(
    "href",
    `https://map.kakao.com/link/by/traffic/${encodeURIComponent("강남역")},37.4979,127.0276/${encodeURIComponent("양재역")},37.4841,127.0346`,
  );
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getAllByRole("link")).toHaveLength(2);
});

test("출발역 좌표가 없는 사람과 목적지가 없을 때는 링크가 없다", () => {
  const legs = [leg({ participant_id: 1, nickname: "민수", origin_lat: null, origin_lng: null }), leg({ participant_id: 2, nickname: "수진" })];
  const { rerender } = render(<LegBars legs={legs} mine={[]} destination={DESTINATION} />);
  expect(screen.queryByRole("link", { name: "민수 길찾기" })).toBeNull();
  expect(screen.getByRole("link", { name: "수진 길찾기" })).toBeInTheDocument();
  rerender(<LegBars legs={legs} mine={[]} />);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});
