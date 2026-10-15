import { expect, test } from "vitest";
import { request } from "./api/client";
import type { ContentOut, ResultOut, RoomOut } from "./api/types";
import { DEMO_HUB_ID, demoResponse, isDemoPath } from "./demo";
import { addDaysIso, todayIso } from "./format";

test("예시 방의 주소만 예시로 본다", () => {
  expect(isDemoPath("/rooms/demo")).toBe(true);
  expect(isDemoPath("/rooms/demo/result?theme=cafe")).toBe(true);
  expect(isDemoPath("/rooms/demox")).toBe(false);
  expect(isDemoPath("/rooms/abc123")).toBe(false);
});

// 테스트 서버(MSW)는 처리하지 않은 요청이 오면 실패한다. 아래 요청이 통과하면 서버를 부르지 않은 것이다.
test("예시 방은 서버를 부르지 않고 미리 담아 둔 응답을 돌려준다", async () => {
  const room = await request<RoomOut>("/rooms/demo");
  expect(room.slug).toBe("demo");
  expect(room.meet_date).toBe(addDaysIso(todayIso(), 7));
  expect(room.participants.map((p) => p.nickname)).toEqual(["나", "친구 1", "친구 2"]);

  const result = await request<ResultOut>("/rooms/demo/result?theme=any");
  expect(result.status).toBe("ready");
  expect(result.recommendations[0].hub_id).toBe(DEMO_HUB_ID);

  const food = await request<ContentOut>(`/rooms/demo/hubs/${DEMO_HUB_ID}/content?kind=food&sort=distance`);
  expect(food.kind).toBe("food");
  expect(food.items.length).toBeGreaterThan(0);
  const missing = (await demoResponse(`/rooms/demo/hubs/${DEMO_HUB_ID}/content?kind=nothing`)) as ContentOut;
  expect(missing).toEqual({ kind: "nothing", items: [], error: null });
});

test("예시 방은 바꿀 수 없다", async () => {
  await expect(request("/rooms/demo", { method: "PATCH", body: "{}" })).rejects.toMatchObject({
    status: 400,
    message: "예시 화면이라 바꿀 수 없어요",
  });
});
