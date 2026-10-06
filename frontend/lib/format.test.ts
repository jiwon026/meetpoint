import { expect, test } from "vitest";
import { aboutMinutes, addDaysIso, average, daysBetween, dday, formatMeetDate, todayIso, walkMinutes } from "./format";

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

test("addDaysIso는 달과 해를 넘겨 더한다", () => {
  expect(addDaysIso("2026-10-05", 7)).toBe("2026-10-12");
  expect(addDaysIso("2026-12-30", 3)).toBe("2027-01-02");
  expect(addDaysIso("2026-10-05", 365)).toBe("2027-10-05");
});

test("daysBetween은 날짜 사이의 일수를 센다 (월과 연도를 넘어도 맞게)", () => {
  expect(daysBetween("2026-10-02", "2026-10-10")).toBe(8);
  expect(daysBetween("2026-10-10", "2026-10-10")).toBe(0);
  expect(daysBetween("2026-10-29", "2026-11-02")).toBe(4);
  expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
});
