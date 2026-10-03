import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";
import { API, participant } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { JoinForm } from "./JoinForm";

const STATIONS = [
  { id: 222, name: "강남", line: "2호선" },
  { id: 901, name: "강남", line: "신분당선" },
];

function stationHandler() {
  return http.get(`${API}/stations`, () => HttpResponse.json(STATIONS));
}

test("역을 골라 등록하면 station_id를 보내고 폼을 비운다", async () => {
  let body: unknown = null;
  server.use(
    stationHandler(),
    http.post(`${API}/rooms/abc123/participants`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(participant({ id: 7, nickname: "민수" }), { status: 201 });
    }),
  );
  const onJoined = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<JoinForm slug="abc123" onJoined={onJoined} />);

  await user.type(screen.getByLabelText("닉네임"), " 민수 ");
  await user.type(screen.getByLabelText("출발지 검색"), "강남");
  await user.click(await screen.findByRole("button", { name: /강남.*신분당선/ }));
  expect(screen.getByText("출발지: 강남 (신분당선)")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));

  await waitFor(() => expect(onJoined).toHaveBeenCalledOnce());
  expect(body).toEqual({ nickname: "민수", station_id: 901 });
  expect(screen.getByLabelText("닉네임")).toHaveValue("");
  expect(screen.getByLabelText("출발지 검색")).toHaveValue("");
});

test("닉네임과 출발지가 없으면 요청하지 않는다", async () => {
  const user = userEvent.setup();
  renderWithClient(<JoinForm slug="abc123" onJoined={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));
  expect(screen.getByRole("alert")).toHaveTextContent("닉네임을 적어주세요");
  await user.type(screen.getByLabelText("닉네임"), "민수");
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));
  expect(screen.getByRole("alert")).toHaveTextContent("출발지를 골라주세요");
});

test("주소를 못 찾으면 문구를 보여주고 역 선택으로 돌린다", async () => {
  server.use(
    http.post(`${API}/places/search`, () =>
      HttpResponse.json({ items: [{ name: "우리집", address: "서울 어딘가 1" }], error: null }),
    ),
    http.post(`${API}/rooms/abc123/participants`, () =>
      HttpResponse.json({ detail: "주소를 찾지 못했어요. 역을 직접 골라주세요." }, { status: 422 }),
    ),
  );
  const user = userEvent.setup();
  renderWithClient(<JoinForm slug="abc123" onJoined={vi.fn()} />);
  await user.type(screen.getByLabelText("닉네임"), "민수");
  await user.click(screen.getByRole("tab", { name: "주소, 건물명 검색" }));
  await user.type(screen.getByLabelText("출발지 검색"), "우리집");
  await user.click(await screen.findByRole("button", { name: /우리집/ }));
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("주소를 찾지 못했어요. 역을 직접 골라주세요.");
  expect(screen.getByRole("tab", { name: "지하철역 선택" })).toHaveAttribute("aria-selected", "true");
});

test("주소 검색이 실패하면 안내 문구를 보여준다", async () => {
  server.use(
    http.post(`${API}/places/search`, () => HttpResponse.json({ items: [], error: "지금 불러올 수 없어요" })),
  );
  const user = userEvent.setup();
  renderWithClient(<JoinForm slug="abc123" onJoined={vi.fn()} />);
  await user.click(screen.getByRole("tab", { name: "주소, 건물명 검색" }));
  await user.type(screen.getByLabelText("출발지 검색"), "강남역");
  expect(await screen.findByText("지금 불러올 수 없어요")).toBeInTheDocument();
});

test("역 검색 요청이 실패하면 연결 안내 문구를 보여준다", async () => {
  server.use(http.get(`${API}/stations`, () => new HttpResponse("Bad Gateway", { status: 502 })));
  const user = userEvent.setup();
  renderWithClient(<JoinForm slug="abc123" onJoined={vi.fn()} />);
  await user.type(screen.getByLabelText("출발지 검색"), "강남");
  expect(await screen.findByText("연결이 불안정해요. 잠시 후 다시 시도해주세요.")).toBeInTheDocument();
});
