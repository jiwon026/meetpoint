import { expect, test } from "vitest";
import { placeIcon } from "./placeIcon";

// 예시 방(신당)에서 실제로 받은 분류 이름들로 본다.
test("맛집 분류 이름에 맞는 아이콘을 고른다", () => {
  expect(placeIcon("food", "갈비")).toBe("meat");
  expect(placeIcon("food", "곱창,막창")).toBe("meat");
  expect(placeIcon("food", "국밥")).toBe("soup");
  expect(placeIcon("food", "순대")).toBe("soup");
  expect(placeIcon("food", "칼국수")).toBe("soup");
  expect(placeIcon("food", "닭요리")).toBe("chicken");
  expect(placeIcon("food", "떡볶이")).toBe("snack");
  expect(placeIcon("food", "해물,생선")).toBe("seafood");
  expect(placeIcon("food", "한식")).toBe("food");
  expect(placeIcon("food", "")).toBe("food");
});

test("카페, 술자리, 놀거리 분류 이름에 맞는 아이콘을 고른다", () => {
  expect(placeIcon("cafe", "디저트카페")).toBe("dessert");
  expect(placeIcon("cafe", "스타벅스")).toBe("coffee");
  expect(placeIcon("cafe", "베이커리카페")).toBe("bakery");
  expect(placeIcon("drink", "오뎅바")).toBe("beer");
  expect(placeIcon("drink", "실내포장마차")).toBe("beer");
  expect(placeIcon("drink", "칵테일바")).toBe("cocktail");
  expect(placeIcon("drink", "와인바")).toBe("wine");
  expect(placeIcon("play", "노래방")).toBe("karaoke");
  expect(placeIcon("play", "만화카페")).toBe("comic");
  expect(placeIcon("play", "방탈출카페")).toBe("escape");
  expect(placeIcon("play", "보드카페")).toBe("board");
  expect(placeIcon("play", "볼링장")).toBe("fun");
});
