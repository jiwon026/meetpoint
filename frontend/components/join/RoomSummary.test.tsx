import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { room } from "@/lib/test/fixtures";
import { RoomSummary } from "./RoomSummary";

test("이름, 날짜, D-day, 지역, 테마, 자동 삭제 안내를 보여준다", () => {
  render(
    <RoomSummary
      room={room({ title: "금요일 저녁", meet_date: "2026-10-10", regions: ["서울", "경기"], theme: "drink" })}
      now={new Date(2026, 9, 6)}
    />,
  );
  expect(screen.getByRole("heading", { name: "금요일 저녁" })).toBeInTheDocument();
  expect(screen.getByText("10월 10일 (토)")).toBeInTheDocument();
  expect(screen.getByText("D-4")).toBeInTheDocument();
  expect(screen.getByText("서울, 경기, 술자리")).toBeInTheDocument();
  expect(screen.getByText("약속 7일 뒤 자동 삭제")).toBeInTheDocument();
});
