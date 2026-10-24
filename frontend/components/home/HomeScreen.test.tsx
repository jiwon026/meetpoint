import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";
import { track } from "@/lib/analytics";
import { readMine } from "@/lib/myParticipants";
import { API, participant, room } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { HomeScreen } from "./HomeScreen";
import { TourProvider } from "@/components/ui/TourProvider";
// 온보딩 제어기(TourProvider)가 쓰는 라우터를 흉내 낸다. 이 파일에서는 주소가 바뀌지 않는다.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));


const TODAY = "2026-10-14";

const STATIONS: Record<string, { id: number; name: string; lines: string[]; line: string }> = {
  강남: { id: 222, name: "강남", lines: ["2호선", "신분당선"], line: "2호선" },
  수원: { id: 77, name: "수원", lines: ["1호선", "수인분당선"], line: "1호선" },
  잠실: { id: 216, name: "잠실", lines: ["2호선", "8호선"], line: "2호선" },
};

function stationHandler() {
  return http.get(`${API}/stations`, ({ request }) => {
    const hit = STATIONS[new URL(request.url).searchParams.get("q") ?? ""];
    return HttpResponse.json(hit ? [hit] : []);
  });
}

// 방 만들기와 참가자 등록을 받아 적는 서버. 요청이 온 순서대로 calls에 쌓인다.
function recordingServer(options: { failParticipantAt?: number; failWith?: { status: number; detail: string } } = {}) {
  const failure = options.failWith ?? { status: 422, detail: "아직 수도권만 지원해요" };
  const calls: { path: string; body: unknown }[] = [];
  let added = 0;
  server.use(
    stationHandler(),
    http.post(`${API}/rooms`, async ({ request }) => {
      calls.push({ path: "/rooms", body: await request.json() });
      return HttpResponse.json(room({ slug: "new123", meet_date: "2026-10-21" }), { status: 201 });
    }),
    http.post(`${API}/rooms/new123/participants`, async ({ request }) => {
      const body = (await request.json()) as { nickname: string };
      calls.push({ path: "/rooms/new123/participants", body });
      added += 1;
      if (added === options.failParticipantAt) {
        return HttpResponse.json({ detail: failure.detail }, { status: failure.status });
      }
      return HttpResponse.json(participant({ id: 100 + added, nickname: body.nickname }), { status: 201 });
    }),
  );
  return calls;
}

// 펼쳐진 줄의 검색 칸에서 역을 찾아 고른다. 고르면 다음 빈 줄이 펼쳐진다.
async function pickStation(user: UserEvent, name: string) {
  await user.type(screen.getByLabelText("출발지 검색"), name);
  await user.click(await screen.findByRole("button", { name: new RegExp(`^${name}`) }));
}

test("처음에는 두 칸이 비어 있고 날짜는 일주일 뒤이며 버튼은 꺼져 있다", () => {
  renderWithClient(<HomeScreen today={TODAY} onStarted={vi.fn()} />);
  expect(within(screen.getByRole("region", { name: "출발지" })).getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByLabelText("나 이름")).toHaveValue("");
  expect(screen.getByLabelText("친구 1 이름")).toHaveValue("");
  expect(screen.getByLabelText("약속 날짜 10월 21일 (수), 달력에서 고르기")).toHaveValue("2026-10-21");
  expect(screen.getByRole("button", { name: "출발지를 두 곳 넣어주세요" })).toBeDisabled();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "7");
});

test("오늘 날짜를 아직 모르는 첫 렌더에서는 날짜 칸 없이 그려지고 버튼이 꺼져 있다", () => {
  renderWithClient(<HomeScreen today="" onStarted={vi.fn()} />);
  expect(screen.queryByLabelText(/약속 날짜/)).toBeNull();
  expect(screen.getByRole("button", { name: "출발지를 두 곳 넣어주세요" })).toBeDisabled();
});

test("출발역 둘을 넣고 누르면 서울 방을 만들고 차례로 등록한 뒤 추천으로 보낸다", async () => {
  const calls = recordingServer();
  const onStarted = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<HomeScreen today={TODAY} onStarted={onStarted} />);

  await pickStation(user, "강남");
  // 고른 줄에는 이름과 노선 배지만 보이고 노선 이름 글씨는 따로 쓰지 않는다.
  const row = within(screen.getByRole("region", { name: "출발지" })).getAllByRole("listitem")[0];
  expect(within(row).getByText("강남")).toBeVisible();
  expect(within(row).getByTitle("신분당선")).toBeInTheDocument();
  expect(within(row).queryByText("2호선, 신분당선")).toBeNull();
  expect(screen.getByRole("button", { name: "출발지를 한 곳 더 넣어주세요" })).toBeDisabled();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "20");
  await pickStation(user, "수원");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
  await user.click(screen.getByRole("button", { name: "추천 보기 (2명)" }));

  await waitFor(() => expect(onStarted).toHaveBeenCalledWith("new123", true));
  expect(calls).toEqual([
    { path: "/rooms", body: { title: "10월 21일 (수) 모임", meet_date: "2026-10-21", regions: ["서울"], themes: [] } },
    { path: "/rooms/new123/participants", body: { nickname: "나", station_id: 222 } },
    { path: "/rooms/new123/participants", body: { nickname: "친구 1", station_id: 77 } },
  ]);
  expect(readMine("new123")).toEqual([101, 102]);
});

test("이름, 모임 이름, 날짜를 바꾸면 그대로 보낸다", async () => {
  const calls = recordingServer();
  const onStarted = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<HomeScreen today={TODAY} onStarted={onStarted} />);

  await user.type(screen.getByLabelText("나 이름"), " 지원 ");
  await pickStation(user, "강남");
  await pickStation(user, "수원");
  await user.click(screen.getByRole("button", { name: "하루 뒤" }));
  await user.click(screen.getByText("모임 이름 붙이기"));
  await user.type(screen.getByLabelText("모임 이름"), "동기 모임");
  await user.click(screen.getByRole("button", { name: "추천 보기 (2명)" }));

  await waitFor(() => expect(onStarted).toHaveBeenCalled());
  expect(calls[0].body).toEqual({ title: "동기 모임", meet_date: "2026-10-22", regions: ["서울"], themes: [] });
  expect(calls[1].body).toEqual({ nickname: "지원", station_id: 222 });
});

test("한 명 더 넣고, 고른 역을 바꾸고, 줄을 지울 수 있다", async () => {
  const calls = recordingServer();
  const onStarted = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<HomeScreen today={TODAY} onStarted={onStarted} />);

  await pickStation(user, "강남");
  await pickStation(user, "수원");
  expect(screen.queryByLabelText("출발지 검색")).toBeNull();
  await user.click(screen.getByRole("button", { name: "한 명 더" }));
  await pickStation(user, "잠실");
  expect(screen.getByRole("button", { name: "추천 보기 (3명)" })).toBeEnabled();

  // 둘째 줄을 지우면 셋째 줄이 "친구 1"이 된다.
  await user.click(screen.getByRole("button", { name: "친구 1 줄 지우기" }));
  expect(screen.getByRole("button", { name: "추천 보기 (2명)" })).toBeEnabled();
  // 첫 줄의 역을 다시 고른다.
  await user.click(screen.getAllByRole("button", { name: "바꾸기" })[0]);
  expect(screen.getByRole("button", { name: "출발지를 한 곳 더 넣어주세요" })).toBeDisabled();
  await pickStation(user, "수원");
  await user.click(screen.getByRole("button", { name: "추천 보기 (2명)" }));

  await waitFor(() => expect(onStarted).toHaveBeenCalledWith("new123", true));
  expect(calls.slice(1).map((call) => call.body)).toEqual([
    { nickname: "나", station_id: 77 },
    { nickname: "친구 1", station_id: 216 },
  ]);
});

test("주소로 넣은 사람은 address로 보낸다", async () => {
  const calls = recordingServer();
  server.use(
    http.post(`${API}/places/search`, () =>
      HttpResponse.json({ items: [{ name: "우리집", address: "서울 어딘가 1" }], error: null }),
    ),
  );
  const onStarted = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<HomeScreen today={TODAY} onStarted={onStarted} />);

  await user.click(screen.getByRole("tab", { name: "주소, 건물명 검색" }));
  await user.type(screen.getByLabelText("출발지 검색"), "우리집");
  await user.click(await screen.findByRole("button", { name: /우리집/ }));
  await pickStation(user, "수원");
  await user.click(screen.getByRole("button", { name: "추천 보기 (2명)" }));

  await waitFor(() => expect(onStarted).toHaveBeenCalled());
  expect(calls[1].body).toEqual({ nickname: "나", address: "서울 어딘가 1" });
});

test("그 사람만의 문제로 못 넣으면 나머지는 계속 넣고, 이유를 알린 뒤 그 방의 사람 추가 화면으로 보낸다", async () => {
  const calls = recordingServer({ failParticipantAt: 2 });
  const onStarted = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<HomeScreen today={TODAY} onStarted={onStarted} />);

  await pickStation(user, "강남");
  await pickStation(user, "수원");
  await user.click(screen.getByRole("button", { name: "한 명 더" }));
  await pickStation(user, "잠실");
  await user.click(screen.getByRole("button", { name: "추천 보기 (3명)" }));

  await waitFor(() => expect(onStarted).toHaveBeenCalledWith("new123", false));
  expect(screen.getByRole("status")).toHaveTextContent("친구 1님의 출발지를 넣지 못했어요. 아직 수도권만 지원해요");
  // 뒤 사람은 그대로 보낸다. 등록된 사람만 내 것으로 기억하고, 통계의 인원은 등록된 순서로 센다.
  expect(calls.slice(1).map((call) => (call.body as { nickname: string }).nickname)).toEqual(["나", "친구 1", "친구 2"]);
  expect(readMine("new123")).toEqual([101, 103]);
  expect(vi.mocked(track).mock.calls.filter(([name]) => name === "participant_added")).toEqual([
    ["participant_added", { method: "station", participant_count: 1 }],
    ["participant_added", { method: "station", participant_count: 2 }],
  ]);
});

test("요청 제한처럼 다음 사람도 막힐 실패면 멈추고, 못 넣은 사람 수를 함께 알린다", async () => {
  const calls = recordingServer({
    failParticipantAt: 2,
    failWith: { status: 429, detail: "요청이 너무 많아요. 잠시 후 다시 시도해주세요." },
  });
  const onStarted = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<HomeScreen today={TODAY} onStarted={onStarted} />);

  await pickStation(user, "강남");
  await pickStation(user, "수원");
  await user.click(screen.getByRole("button", { name: "한 명 더" }));
  await pickStation(user, "잠실");
  await user.click(screen.getByRole("button", { name: "추천 보기 (3명)" }));

  await waitFor(() => expect(onStarted).toHaveBeenCalledWith("new123", false));
  expect(screen.getByRole("status")).toHaveTextContent(
    "친구 1님의 출발지를 넣지 못했어요. 요청이 너무 많아요. 잠시 후 다시 시도해주세요. 다른 1명도 아직 못 넣었어요.",
  );
  expect(calls).toHaveLength(3);
  expect(readMine("new123")).toEqual([101]);
});

test("줄을 열거나 역을 고른 뒤에는 펼쳐진 검색 칸에 초점이 간다", async () => {
  recordingServer();
  const user = userEvent.setup();
  renderWithClient(<HomeScreen today={TODAY} onStarted={vi.fn()} />);
  // 처음에는 자판이 올라오지 않게 초점을 주지 않는다.
  expect(screen.getByLabelText("출발지 검색")).not.toHaveFocus();
  await pickStation(user, "강남");
  expect(screen.getByLabelText("출발지 검색")).toHaveFocus();
});

test("방을 만들지 못하면 문구를 보여주고 다시 누를 수 있다", async () => {
  server.use(
    stationHandler(),
    http.post(`${API}/rooms`, () =>
      HttpResponse.json({ detail: "요청이 너무 많아요. 잠시 후 다시 시도해주세요." }, { status: 429 }),
    ),
  );
  const onStarted = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<HomeScreen today={TODAY} onStarted={onStarted} />);

  await pickStation(user, "강남");
  await pickStation(user, "수원");
  await user.click(screen.getByRole("button", { name: "추천 보기 (2명)" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("요청이 너무 많아요. 잠시 후 다시 시도해주세요.");
  expect(screen.getByRole("button", { name: "추천 보기 (2명)" })).toBeEnabled();
  expect(onStarted).not.toHaveBeenCalled();
});

test("기다리는 동안 버튼이 잠겨 방을 두 번 만들지 않는다", async () => {
  let rooms = 0;
  server.use(
    stationHandler(),
    http.post(`${API}/rooms`, async () => {
      rooms += 1;
      await delay(50);
      return HttpResponse.json(room({ slug: "new123" }), { status: 201 });
    }),
    http.post(`${API}/rooms/new123/participants`, () => HttpResponse.json(participant(), { status: 201 })),
  );
  const onStarted = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<HomeScreen today={TODAY} onStarted={onStarted} />);

  await pickStation(user, "강남");
  await pickStation(user, "수원");
  await user.click(screen.getByRole("button", { name: "추천 보기 (2명)" }));
  const waiting = screen.getByRole("button", { name: "추천을 계산하는 중" });
  expect(waiting).toBeDisabled();
  await user.click(waiting);

  await waitFor(() => expect(onStarted).toHaveBeenCalledOnce());
  expect(rooms).toBe(1);
  // 다른 화면으로 넘어갈 때까지 잠긴 채로 둔다.
  expect(screen.getByRole("button", { name: "추천을 계산하는 중" })).toBeDisabled();
});

test("통계에는 개수와 방식만 남기고 이름과 역은 넣지 않는다", async () => {
  recordingServer();
  const onStarted = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<HomeScreen today={TODAY} onStarted={onStarted} />);

  await user.type(screen.getByLabelText("나 이름"), "별빛토끼");
  await pickStation(user, "강남");
  await pickStation(user, "수원");
  await user.click(screen.getByRole("button", { name: "추천 보기 (2명)" }));
  await waitFor(() => expect(onStarted).toHaveBeenCalled());

  expect(vi.mocked(track).mock.calls).toEqual([
    ["origin_drafted", { count: 1 }],
    ["origin_drafted", { count: 2 }],
    ["room_created", { regions: "서울", region_count: 1, theme: "none", days_until_meet: 7 }],
    ["participant_added", { method: "station", participant_count: 1 }],
    ["participant_added", { method: "station", participant_count: 2 }],
  ]);
  const sent = JSON.stringify(vi.mocked(track).mock.calls);
  for (const secret of ["별빛토끼", "강남", "수원", "new123"]) expect(sent).not.toContain(secret);
});

test("사용법은 저절로 뜨지 않고 사용법 보기를 눌렀을 때만 연다", async () => {
  const user = userEvent.setup();
  renderWithClient(
    <TourProvider>
      <HomeScreen today={TODAY} onStarted={vi.fn()} />
    </TourProvider>,
  );
  expect(await screen.findByLabelText("나 이름")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).toBeNull();

  await user.click(screen.getByRole("button", { name: "사용법 보기" }));
  expect(screen.getByRole("dialog", { name: "1. 출발지를 넣어요" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "건너뛰기" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("내 출발지만 넣으면 링크로 친구를 부르는 길이 나오고, 누르면 방을 만들어 참여 화면으로 보낸다", async () => {
  const calls = recordingServer();
  const onStarted = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<HomeScreen today={TODAY} onStarted={onStarted} />);

  expect(screen.queryByRole("button", { name: "친구에게 링크 보내서 각자 넣기" })).toBeNull();
  await pickStation(user, "강남");
  await user.click(screen.getByRole("button", { name: "친구에게 링크 보내서 각자 넣기" }));

  await waitFor(() => expect(onStarted).toHaveBeenCalledWith("new123", false));
  expect(calls.map((call) => call.path)).toEqual(["/rooms", "/rooms/new123/participants"]);
  expect(screen.getByRole("status")).toHaveTextContent("방을 만들었어요. 초대 링크를 친구에게 보내 주세요");
  expect(readMine("new123")).toEqual([101]);
});

test("두 곳을 넣으면 링크 길은 숨기고 추천 보기만 남긴다", async () => {
  recordingServer();
  const user = userEvent.setup();
  renderWithClient(<HomeScreen today={TODAY} onStarted={vi.fn()} />);
  await pickStation(user, "강남");
  await pickStation(user, "수원");
  expect(screen.queryByRole("button", { name: "친구에게 링크 보내서 각자 넣기" })).toBeNull();
  expect(screen.getByRole("button", { name: "추천 보기 (2명)" })).toBeEnabled();
});
