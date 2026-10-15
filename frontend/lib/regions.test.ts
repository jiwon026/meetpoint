import { expect, test } from "vitest";
import { parseRegions } from "./regions";

test("parseRegions는 모르는 값을 버리고 순서를 서울, 경기, 인천으로 맞춘다", () => {
  expect(parseRegions(["인천", "부산", "서울", "서울"])).toEqual(["서울", "인천"]);
  expect(parseRegions([])).toEqual([]);
});
