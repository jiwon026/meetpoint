import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { API, participant, result, room } from "@/lib/test/fixtures";
import { clientWrapper } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { ApiError } from "./client";
import {
  resultPath,
  shouldRetry,
  useAddParticipant,
  usePlaceSearch,
  useResult,
  useRoom,
  useSetParticipantActive,
  useStationSearch,
} from "./hooks";

test("resultPath는 필터를 쿼리로 붙인다", () => {
  expect(resultPath("abc123", { regions: null, theme: null })).toBe("/rooms/abc123/result");
  expect(resultPath("abc123", { regions: ["서울"], theme: "cafe" })).toBe(
    "/rooms/abc123/result?region=%EC%84%9C%EC%9A%B8&theme=cafe",
  );
});

test("shouldRetry는 4xx를 다시 시도하지 않는다", () => {
  expect(shouldRetry(0, new ApiError(404, "x"))).toBe(false);
  expect(shouldRetry(0, new ApiError(500, "x"))).toBe(true);
  expect(shouldRetry(2, new ApiError(500, "x"))).toBe(false);
});

test("useRoom은 방을 불러온다", async () => {
  server.use(http.get(`${API}/rooms/abc123`, () => HttpResponse.json(room({ title: "주말" }))));
  const { result: hook } = renderHook(() => useRoom("abc123"), { wrapper: clientWrapper() });
  await waitFor(() => expect(hook.current.data?.title).toBe("주말"));
});

test("useResult는 필터를 쿼리로 보낸다", async () => {
  let seen = "";
  server.use(
    http.get(`${API}/rooms/abc123/result`, ({ request }) => {
      seen = new URL(request.url).search;
      return HttpResponse.json(result({ regions: ["경기"] }));
    }),
  );
  const { result: hook } = renderHook(() => useResult("abc123", { regions: ["경기"], theme: "any" }), {
    wrapper: clientWrapper(),
  });
  await waitFor(() => expect(hook.current.data?.regions).toEqual(["경기"]));
  expect(new URLSearchParams(seen).getAll("region")).toEqual(["경기"]);
  expect(new URLSearchParams(seen).get("theme")).toBe("any");
});

test("useAddParticipant는 본문을 보내고 결과를 돌려준다", async () => {
  let body: unknown = null;
  server.use(
    http.post(`${API}/rooms/abc123/participants`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(participant({ id: 7 }), { status: 201 });
    }),
  );
  const { result: hook } = renderHook(() => useAddParticipant("abc123"), { wrapper: clientWrapper() });
  hook.current.mutate({ nickname: "민수", station_id: 2 });
  await waitFor(() => expect(hook.current.data?.id).toBe(7));
  expect(body).toEqual({ nickname: "민수", station_id: 2 });
});

test("useSetParticipantActive는 PATCH로 active를 보낸다", async () => {
  let body: unknown = null;
  server.use(
    http.patch(`${API}/rooms/abc123/participants/7`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(participant({ id: 7, active: false }));
    }),
  );
  const { result: hook } = renderHook(() => useSetParticipantActive("abc123"), { wrapper: clientWrapper() });
  hook.current.mutate({ id: 7, active: false });
  await waitFor(() => expect(hook.current.data?.active).toBe(false));
  expect(body).toEqual({ active: false });
});

test("useStationSearch는 빈 검색어로는 부르지 않는다", async () => {
  const { result: hook } = renderHook(() => useStationSearch("  "), { wrapper: clientWrapper() });
  expect(hook.current.fetchStatus).toBe("idle");
});

test("usePlaceSearch는 검색어를 URL이 아니라 본문으로 보낸다", async () => {
  let url = "";
  let body: unknown = null;
  server.use(
    http.post(`${API}/places/search`, async ({ request }) => {
      url = request.url;
      body = await request.json();
      return HttpResponse.json({ items: [{ name: "강남구청", address: "서울 강남구 삼성동 16-1" }], error: null });
    }),
  );
  const { result: hook } = renderHook(() => usePlaceSearch("강남구청"), { wrapper: clientWrapper() });
  await waitFor(() => expect(hook.current.data?.items).toHaveLength(1));
  expect(url).toBe(`${API}/places/search`);
  expect(body).toEqual({ q: "강남구청" });
});
