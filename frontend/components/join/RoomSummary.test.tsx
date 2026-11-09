import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { room } from "@/lib/test/fixtures";
import { RoomSummary } from "./RoomSummary";

test("이름, 한 줄 설명, 지역, 테마, 지우는 날을 보여준다. 약속 날짜는 보여주지도 고르게 하지도 않는다", () => {
  render(
    <RoomSummary
      room={room({
        title: "금요일 저녁",
        meet_date: "2026-10-10",
        expires_at: "2026-10-17T00:00:00",
        regions: ["서울", "경기"],
        themes: ["food", "drink"],
      })}
    />,
  );
  expect(screen.getByRole("heading", { name: "금요일 저녁" })).toBeInTheDocument();
  expect(screen.getByText("각자 출발지를 넣으면 모두에게 공평한 만남 장소를 추천해요.")).toBeInTheDocument();
  expect(screen.getByText("서울, 경기, 맛집, 술자리")).toBeInTheDocument();
  expect(screen.getByText("10월 17일 (토) 자동 삭제")).toBeInTheDocument();
  // 약속 날짜는 둘러보기의 행사 탭에서 고른다.
  expect(screen.queryByText("10월 10일 (토)")).toBeNull();
  expect(screen.queryByRole("button", { name: "하루 뒤" })).toBeNull();
});
