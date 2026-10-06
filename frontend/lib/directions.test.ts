import { expect, test } from "vitest";
import { stationLabel, transitDirectionsUrl } from "./directions";

test("역 이름에 역을 붙이되 이미 붙어 있으면 그대로 둔다", () => {
  expect(stationLabel("강남")).toBe("강남역");
  expect(stationLabel("서울역")).toBe("서울역");
});

test("카카오맵 대중교통 길찾기 주소를 만든다", () => {
  const url = transitDirectionsUrl({ name: "홍대입구", lat: 37.5571, lng: 126.9245 }, { name: "강남", lat: 37.4979, lng: 127.0276 });
  expect(url).toBe(
    `https://map.kakao.com/link/by/traffic/${encodeURIComponent("홍대입구역")},37.5571,126.9245/${encodeURIComponent("강남역")},37.4979,127.0276`,
  );
});

test("이름의 쉼표와 빗금이 주소의 구분자를 깨지 않는다", () => {
  const url = transitDirectionsUrl({ name: "가,나/다", lat: 1, lng: 2 }, { name: "라", lat: 3, lng: 4 });
  expect(url.split("/link/by/traffic/")[1].split("/")).toHaveLength(2);
  expect(url).toContain("%2C");
});
