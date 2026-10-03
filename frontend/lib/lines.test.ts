import { expect, test } from "vitest";
import { lineStyle, shortLine } from "./lines";

test("알려진 노선은 노선 색, 모르는 노선은 회색", () => {
  expect(lineStyle("2호선").background).toBe("#00a84d");
  expect(lineStyle("없는선").background).toBe("#8a8f8c");
});

test("밝은 노선 색에는 어두운 글자", () => {
  expect(lineStyle("수인분당선").color).toBe("#1c1c1a");
  expect(lineStyle("2호선").color).toBe("#ffffff");
});

test("shortLine은 숫자 노선만 줄인다", () => {
  expect(shortLine("2호선")).toBe("2");
  expect(shortLine("인천1호선")).toBe("인천1");
  expect(shortLine("신분당선")).toBe("신분당선");
});
