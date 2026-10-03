import { expect, test } from "vitest";
import { addMine, readMine } from "./myParticipants";

test("처음에는 비어 있다", () => {
  expect(readMine("abc123")).toEqual([]);
});

test("addMine은 중복 없이 쌓고 방마다 따로 저장한다", () => {
  expect(addMine("abc123", 7)).toEqual([7]);
  expect(addMine("abc123", 9)).toEqual([7, 9]);
  expect(addMine("abc123", 7)).toEqual([7, 9]);
  expect(readMine("zzz999")).toEqual([]);
  expect(window.localStorage.getItem("wjm:room:abc123:mine")).toBe("[7,9]");
});

test("깨진 저장값은 빈 목록으로 본다", () => {
  window.localStorage.setItem("wjm:room:abc123:mine", "{not json");
  expect(readMine("abc123")).toEqual([]);
  window.localStorage.setItem("wjm:room:abc123:mine", JSON.stringify(["a", 3, null]));
  expect(readMine("abc123")).toEqual([3]);
});
