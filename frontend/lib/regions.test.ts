import { expect, test } from "vitest";
import { isAllRegions, parseRegions, toggleRegion } from "./regions";

test("parseRegions는 모르는 값을 버리고 순서를 서울, 경기, 인천으로 맞춘다", () => {
  expect(parseRegions(["인천", "부산", "서울", "서울"])).toEqual(["서울", "인천"]);
  expect(parseRegions([])).toEqual([]);
});

test("isAllRegions는 셋 다 있을 때만 참", () => {
  expect(isAllRegions(["서울", "경기", "인천"])).toBe(true);
  expect(isAllRegions(["서울", "경기"])).toBe(false);
});

test("toggleRegion은 켜고 끄되 마지막 하나는 끄지 않는다", () => {
  expect(toggleRegion(["서울", "경기"], "경기")).toEqual(["서울"]);
  expect(toggleRegion(["서울"], "인천")).toEqual(["서울", "인천"]);
  expect(toggleRegion(["서울"], "서울")).toEqual(["서울"]);
});
