import { expect, test } from "vitest";
import { joinSource } from "./joinSource";

const of = (query: string) => joinSource(new URLSearchParams(query));

test("주소에 붙은 표시로 참여 화면에 어떻게 왔는지 가른다", () => {
  expect(of("")).toBe("link");
  expect(of("add=1&from=add")).toBe("add_people");
  expect(of("add=1&from=home")).toBe("home");
  expect(of("add=1&from=tour")).toBe("tour");
  // 표시 없이 add=1만 있으면 추천 화면에서 뒤로 온 것이다.
  expect(of("add=1")).toBe("back");
  expect(of("add=1&from=모름")).toBe("back");
});
