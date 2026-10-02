import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, expect, test, vi } from "vitest";
import { API, participant, room } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { JoinScreen } from "./JoinScreen";

afterEach(() => vi.restoreAllMocks());

const TWO = [participant({ id: 1, nickname: "민수" }), participant({ id: 2, nickname: "수진" })];

test("두 명 이상이면 추천 보기 버튼", async () => {
  const onShowResult = vi.fn();
  renderWithClient(<JoinScreen slug="abc123" room={room({ participants: TWO })} onShowResult={onShowResult} />);
  await userEvent.click(screen.getByRole("button", { name: "추천 보기 (2명)" }));
  expect(onShowResult).toHaveBeenCalledOnce();
});

test("빠진 사람은 인원에서 빼고, 한 명 이하면 초대 안내", () => {
  const people = [TWO[0], { ...TWO[1], active: false }];
  renderWithClient(<JoinScreen slug="abc123" room={room({ participants: people })} onShowResult={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /추천 보기/ })).toBeNull();
  expect(screen.getByText("친구를 초대하세요. 두 명부터 추천이 나와요.")).toBeInTheDocument();
});

test("스무 명이면 폼 대신 가득 찼다는 안내", () => {
  const twenty = Array.from({ length: 20 }, (_, i) => participant({ id: i + 1, nickname: `참여자${i}` }));
  renderWithClient(<JoinScreen slug="abc123" room={room({ participants: twenty })} onShowResult={vi.fn()} />);
  expect(screen.getByText("참여 인원이 가득 찼어요 (최대 20명)")).toBeInTheDocument();
  expect(screen.queryByLabelText("닉네임")).toBeNull();
});

test("빼기는 확인을 받은 뒤 PATCH를 보낸다", async () => {
  let body: unknown = null;
  server.use(
    http.patch(`${API}/rooms/abc123/participants/1`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(participant({ id: 1, active: false }));
    }),
  );
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  renderWithClient(<JoinScreen slug="abc123" room={room({ participants: TWO })} onShowResult={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "민수 빼기" }));
  expect(confirm).toHaveBeenCalledWith("민수님을 계산에서 뺄까요? 다시 넣을 수 있어요");
  await waitFor(() => expect(body).toEqual({ active: false }));
});

test("확인을 취소하면 요청하지 않는다", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  renderWithClient(<JoinScreen slug="abc123" room={room({ participants: TWO })} onShowResult={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "민수 빼기" }));
  // 요청이 나갔다면 핸들러가 없어 MSW가 테스트를 실패시킨다
});

test("다시 넣기는 확인 없이 보낸다", async () => {
  let body: unknown = null;
  server.use(
    http.patch(`${API}/rooms/abc123/participants/2`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(participant({ id: 2, active: true }));
    }),
  );
  const confirm = vi.spyOn(window, "confirm");
  const people = [TWO[0], { ...TWO[1], active: false }];
  renderWithClient(<JoinScreen slug="abc123" room={room({ participants: people })} onShowResult={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "수진 다시 넣기" }));
  await waitFor(() => expect(body).toEqual({ active: true }));
  expect(confirm).not.toHaveBeenCalled();
});

test("등록하면 이 브라우저가 넣은 사람으로 기억한다", async () => {
  server.use(
    http.get(`${API}/stations`, () => HttpResponse.json([{ id: 222, name: "강남", line: "2호선" }])),
    http.post(`${API}/rooms/abc123/participants`, () =>
      HttpResponse.json(participant({ id: 9, nickname: "지은" }), { status: 201 }),
    ),
  );
  const user = userEvent.setup();
  renderWithClient(<JoinScreen slug="abc123" room={room()} onShowResult={vi.fn()} />);
  await user.type(screen.getByLabelText("닉네임"), "지은");
  await user.type(screen.getByLabelText("출발지 검색"), "강남");
  await user.click(await screen.findByRole("button", { name: /강남/ }));
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));
  await waitFor(() => expect(window.localStorage.getItem("wjm:room:abc123:mine")).toBe("[9]"));
});
