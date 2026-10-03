import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { server } from "./server";

test("MSW가 fetch를 가로챈다", async () => {
  server.use(http.get("http://localhost:8000/health", () => HttpResponse.json({ ok: true })));
  const response = await fetch("http://localhost:8000/health");
  expect(await response.json()).toEqual({ ok: true });
});
