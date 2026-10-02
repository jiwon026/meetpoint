import { expect, test } from "vitest";
import { filterFromSearch, filterQuery, NO_FILTER } from "./filter";

test("필터가 없으면 빈 문자열", () => {
  expect(filterQuery(NO_FILTER)).toBe("");
});

test("filterQuery와 filterFromSearch는 서로 되돌린다", () => {
  const filter = { regions: ["서울", "경기"] as const, theme: "cafe" };
  const query = filterQuery(filter);
  expect(query.startsWith("?region=")).toBe(true);
  expect(filterFromSearch(new URLSearchParams(query.slice(1)))).toEqual({ regions: ["서울", "경기"], theme: "cafe" });
});

test("모르는 지역과 테마는 버린다", () => {
  const filter = filterFromSearch(new URLSearchParams("region=부산&theme=study"));
  expect(filter).toEqual({ regions: null, theme: null });
});

test("any는 테마 끔으로 유지된다", () => {
  expect(filterFromSearch(new URLSearchParams("theme=any")).theme).toBe("any");
  expect(filterQuery({ regions: null, theme: "any" })).toBe("?theme=any");
});
