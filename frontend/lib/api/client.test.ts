import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { API } from "@/lib/test/fixtures";
import { server } from "@/lib/test/server";
import { ApiError, request } from "./client";

async function failure(path: string): Promise<ApiError> {
  try {
    await request(path);
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("실패해야 하는 요청이 성공했다");
}

test("성공하면 본문을 돌려준다", async () => {
  server.use(http.get(`${API}/health`, () => HttpResponse.json({ ok: true })));
  expect(await request<{ ok: boolean }>("/health")).toEqual({ ok: true });
});

test("detail이 문자열이면 그 문구를 그대로 쓴다", async () => {
  server.use(http.get(`${API}/rooms/x`, () => HttpResponse.json({ detail: "약속이 지난 방이에요" }, { status: 410 })));
  const error = await failure("/rooms/x");
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(410);
  expect(error.message).toBe("약속이 지난 방이에요");
});

test("detail이 목록이면 입력 확인 문구", async () => {
  server.use(http.post(`${API}/rooms`, () => HttpResponse.json({ detail: [{ msg: "field required" }] }, { status: 422 })));
  await expect(request("/rooms", { method: "POST", body: "{}" })).rejects.toMatchObject({
    status: 422,
    message: "입력을 다시 확인해주세요",
  });
});

test("서버에 닿지 못하면 연결 문구와 status 0", async () => {
  server.use(http.get(`${API}/down`, () => HttpResponse.error()));
  const error = await failure("/down");
  expect(error.status).toBe(0);
  expect(error.message).toBe("연결이 불안정해요. 잠시 후 다시 시도해주세요.");
});

test("본문이 JSON이 아니면 연결 문구", async () => {
  server.use(http.get(`${API}/broken`, () => new HttpResponse("oops", { status: 502 })));
  const error = await failure("/broken");
  expect(error.status).toBe(502);
  expect(error.message).toBe("연결이 불안정해요. 잠시 후 다시 시도해주세요.");
});
