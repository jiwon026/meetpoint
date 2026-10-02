import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { API, room } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { RoomGate } from "./RoomGate";

test("방을 불러오면 children에 넘긴다", async () => {
  server.use(http.get(`${API}/rooms/abc123`, () => HttpResponse.json(room({ title: "주말 모임" }))));
  renderWithClient(<RoomGate slug="abc123">{(r) => <p>{r.title}</p>}</RoomGate>);
  expect(screen.getByText("불러오는 중이에요")).toBeInTheDocument();
  expect(await screen.findByText("주말 모임")).toBeInTheDocument();
});

test.each([
  [404, "방을 찾을 수 없어요"],
  [410, "약속이 지난 방이에요"],
])("%i이면 백엔드 문구와 새 방 만들기 링크", async (status, detail) => {
  server.use(http.get(`${API}/rooms/abc123`, () => HttpResponse.json({ detail }, { status })));
  renderWithClient(<RoomGate slug="abc123">{() => <p>내용</p>}</RoomGate>);
  expect(await screen.findByRole("alert")).toHaveTextContent(detail);
  expect(screen.getByRole("link", { name: "새 방 만들기" })).toHaveAttribute("href", "/");
  expect(screen.queryByText("내용")).toBeNull();
});
