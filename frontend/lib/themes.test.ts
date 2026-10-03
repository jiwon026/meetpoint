import { expect, test } from "vitest";
import { CONTENT_TABS, firstTab, parseTheme, themeLabel, THEMES } from "./themes";

test("테마는 네 가지, 탭은 네 가지", () => {
  expect(THEMES.map((t) => t.id)).toEqual(["food", "cafe", "drink", "play"]);
  expect(CONTENT_TABS.map((t) => t.kind)).toEqual(["food", "cafe", "play", "event"]);
});

test("themeLabel은 한글 이름을, 모르는 값과 없음에는 null을 준다", () => {
  expect(themeLabel("drink")).toBe("술자리");
  expect(themeLabel("study")).toBeNull();
  expect(themeLabel(null)).toBeNull();
});

test("parseTheme은 테마 id와 any만 통과시킨다", () => {
  expect(parseTheme("cafe")).toBe("cafe");
  expect(parseTheme("any")).toBe("any");
  expect(parseTheme("study")).toBeNull();
  expect(parseTheme(null)).toBeNull();
});

test("firstTab: 술자리는 맛집 탭, 테마가 없으면 맛집 탭", () => {
  expect(firstTab("cafe")).toBe("cafe");
  expect(firstTab("play")).toBe("play");
  expect(firstTab("drink")).toBe("food");
  expect(firstTab(null)).toBe("food");
});
