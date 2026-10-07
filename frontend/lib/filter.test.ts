import { expect, test } from "vitest";
import { filterFromSearch, filterQuery, NO_FILTER, type ResultFilter } from "./filter";

test("필터가 없으면 빈 문자열", () => {
  expect(filterQuery(NO_FILTER)).toBe("");
});

test("filterQuery와 filterFromSearch는 서로 되돌린다", () => {
  const filter: ResultFilter = { regions: ["서울", "경기"], themes: ["cafe", "drink"] };
  const query = filterQuery(filter);
  expect(query.startsWith("?region=")).toBe(true);
  expect(query.endsWith("theme=cafe&theme=drink")).toBe(true);
  expect(filterFromSearch(new URLSearchParams(query.slice(1)))).toEqual(filter);
});

test("테마를 하나만 적은 예전 링크도 읽는다", () => {
  expect(filterFromSearch(new URLSearchParams("theme=cafe")).themes).toEqual(["cafe"]);
});

test("모르는 지역과 테마는 버린다", () => {
  const filter = filterFromSearch(new URLSearchParams("region=부산&theme=study"));
  expect(filter).toEqual({ regions: null, themes: null });
});

test("any는 테마 끔으로 유지된다", () => {
  expect(filterFromSearch(new URLSearchParams("theme=any")).themes).toBe("any");
  expect(filterQuery({ regions: null, themes: "any" })).toBe("?theme=any");
});
