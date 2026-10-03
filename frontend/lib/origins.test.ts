import { expect, test } from "vitest";
import { leg } from "@/lib/test/fixtures";
import { legOrigins } from "./origins";

test("출발역 좌표와 역 이름 (닉네임) 라벨을 만든다", () => {
  expect(legOrigins([leg({ participant_id: 7, nickname: "민수", origin_station_name: "강남" })])).toEqual([
    { id: "7", lat: 37.4979, lng: 127.0276, label: "강남 (민수)" },
  ]);
});

test("좌표가 없는 사람은 뺀다", () => {
  expect(legOrigins([leg({ origin_lat: null, origin_lng: null }), leg({ participant_id: 2 })])).toHaveLength(1);
});
