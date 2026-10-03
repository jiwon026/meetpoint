import { expect, test } from "vitest";
import { aboutMinutes, average, dday, formatMeetDate, todayIso, walkMinutes } from "./format";

test("aboutMinutes", () => {
  expect(aboutMinutes(45)).toBe("약 45분");
});

test("walkMinutes는 분당 67m로 올림하고 최소 1분", () => {
  expect(walkMinutes(210)).toBe(4);
  expect(walkMinutes(67)).toBe(1);
  expect(walkMinutes(68)).toBe(2);
  expect(walkMinutes(0)).toBe(1);
});

test("average는 반올림하고 빈 목록은 0", () => {
  expect(average([12, 16, 22])).toBe(17);
  expect(average([])).toBe(0);
});

test("todayIso는 현지 날짜", () => {
  expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
});

test("formatMeetDate", () => {
  expect(formatMeetDate("2026-10-10")).toBe("10월 10일 (토)");
});

test("dday", () => {
  expect(dday("2026-10-10", new Date(2026, 9, 6, 23, 30))).toBe("D-4");
  expect(dday("2026-10-10", new Date(2026, 9, 10, 8, 0))).toBe("D-DAY");
  expect(dday("2026-10-10", new Date(2026, 9, 12, 8, 0))).toBe("D+2");
});
