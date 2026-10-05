import { delay, http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { API, room } from "@/lib/test/fixtures";
import { server } from "@/lib/test/server";
import { roomMetadata } from "./roomMeta";

const NOINDEX = { index: false, follow: false };

test("방 제목과 약속 날짜를 넣고 검색 노출은 막는다", async () => {
  server.use(
    http.get(`${API}/rooms/abc123`, () => HttpResponse.json(room({ title: "주말 모임", meet_date: "2026-10-10" }))),
  );
  const meta = await roomMetadata("abc123");
  expect(meta.title).toBe("주말 모임 | 우리지금만나");
  expect(meta.description).toContain("10월 10일");
  expect(meta.robots).toEqual(NOINDEX);
});

test("방이 없으면 기본 제목, 검색 노출은 여전히 막는다", async () => {
  server.use(http.get(`${API}/rooms/abc123`, () => HttpResponse.json({ detail: "x" }, { status: 404 })));
  expect(await roomMetadata("abc123")).toEqual({ title: "우리지금만나", robots: NOINDEX });
});

test("백엔드가 늦으면 기다리지 않고 기본 제목으로 넘어간다", async () => {
  server.use(
    http.get(`${API}/rooms/abc123`, async () => {
      await delay(2000);
      return HttpResponse.json(room());
    }),
  );
  const started = Date.now();
  expect(await roomMetadata("abc123", 50)).toEqual({ title: "우리지금만나", robots: NOINDEX });
  expect(Date.now() - started).toBeLessThan(1000);
});

test("슬러그를 인코딩해서 보낸다", async () => {
  let seen = "";
  server.use(
    http.get(`${API}/rooms/:slug`, ({ request }) => {
      seen = new URL(request.url).pathname;
      return HttpResponse.json(room());
    }),
  );
  await roomMetadata("a b/c");
  expect(seen).toBe("/rooms/a%20b%2Fc");
});
