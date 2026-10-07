import { expect, test } from "vitest";
import { CONTENT_TABS, firstTab, parseThemes, pickThemes, themeLabels, THEMES } from "./themes";

test("테마는 네 가지, 탭은 다섯 가지", () => {
  expect(THEMES.map((t) => t.id)).toEqual(["food", "cafe", "drink", "play"]);
  expect(CONTENT_TABS.map((t) => t.kind)).toEqual(["food", "cafe", "drink", "play", "event"]);
});

test("themeLabels는 정해진 순서의 한글 이름을 주고 모르는 값은 버린다", () => {
  expect(themeLabels(["drink", "food"])).toEqual(["맛집", "술자리"]);
  expect(themeLabels(["study"])).toEqual([]);
  expect(themeLabels(null)).toEqual([]);
});

test("pickThemes는 중복과 모르는 값을 버리고 순서를 맞춘다", () => {
  expect(pickThemes(["play", "cafe", "cafe", "study"])).toEqual(["cafe", "play"]);
  expect(pickThemes(undefined)).toEqual([]);
});

test("parseThemes: any가 있으면 any, 아는 값이 없으면 null", () => {
  expect(parseThemes(["cafe"])).toEqual(["cafe"]);
  expect(parseThemes(["drink", "food"])).toEqual(["food", "drink"]);
  expect(parseThemes(["food", "any"])).toBe("any");
  expect(parseThemes(["study"])).toBeNull();
  expect(parseThemes([])).toBeNull();
});

test("firstTab: 고른 테마 중 순서가 가장 앞선 것의 탭, 테마가 없으면 맛집 탭", () => {
  expect(firstTab(["cafe"])).toBe("cafe");
  expect(firstTab(["play"])).toBe("play");
  expect(firstTab(["drink"])).toBe("drink");
  expect(firstTab(["play", "drink"])).toBe("drink");
  expect(firstTab([])).toBe("food");
  expect(firstTab(null)).toBe("food");
});
