import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, expect, test, vi } from "vitest";
import { track } from "@/lib/analytics";
import { API, participant, room } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { JoinScreen } from "./JoinScreen";
import { TourProvider } from "@/components/ui/TourProvider";
// 온보딩 제어기(TourProvider)가 쓰는 라우터를 흉내 낸다. 이 파일에서는 주소가 바뀌지 않는다.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/r/abc123" }));



afterEach(() => vi.restoreAllMocks());

const TWO = [participant({ id: 1, nickname: "민수" }), participant({ id: 2, nickname: "수진" })];

test("두 명 이상이면 추천 보기 버튼", async () => {
  const onShowResult = vi.fn();
  renderWithClient(<JoinScreen source="link" slug="abc123" room={room({ participants: TWO })} onShowResult={onShowResult} />);
  await userEvent.click(screen.getByRole("button", { name: "추천 보기 (2명)" }));
  expect(onShowResult).toHaveBeenCalledOnce();
});

test("빠진 사람은 인원에서 빼고, 한 명 이하면 초대 안내", () => {
  const people = [TWO[0], { ...TWO[1], active: false }];
  renderWithClient(<JoinScreen source="link" slug="abc123" room={room({ participants: people })} onShowResult={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /추천 보기/ })).toBeNull();
  expect(screen.getByText("친구를 초대하세요. 두 명부터 추천이 나와요.")).toBeInTheDocument();
});

test("스무 명이면 폼 대신 가득 찼다는 안내", () => {
  const twenty = Array.from({ length: 20 }, (_, i) => participant({ id: i + 1, nickname: `참여자${i}` }));
  renderWithClient(<JoinScreen source="link" slug="abc123" room={room({ participants: twenty })} onShowResult={vi.fn()} />);
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
  renderWithClient(<JoinScreen source="link" slug="abc123" room={room({ participants: TWO })} onShowResult={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "민수 빼기" }));
  expect(confirm).toHaveBeenCalledWith("민수님을 계산에서 뺄까요? 다시 넣을 수 있어요");
  await waitFor(() => expect(body).toEqual({ active: false }));
});

test("확인을 취소하면 요청하지 않는다", async () => {
  let patched = false;
  server.use(
    http.patch(`${API}/rooms/abc123/participants/1`, () => {
      patched = true;
      return HttpResponse.json(participant({ id: 1, active: false }));
    }),
  );
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  renderWithClient(<JoinScreen source="link" slug="abc123" room={room({ participants: TWO })} onShowResult={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "민수 빼기" }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(confirm).toHaveBeenCalledWith("민수님을 계산에서 뺄까요? 다시 넣을 수 있어요");
  // 요청이 나갔다면 도착할 시간을 준다
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(patched).toBe(false);
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
  renderWithClient(<JoinScreen source="link" slug="abc123" room={room({ participants: people })} onShowResult={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "수진 다시 넣기" }));
  await waitFor(() => expect(body).toEqual({ active: true }));
  expect(confirm).not.toHaveBeenCalled();
});

test("등록하면 이 브라우저가 넣은 사람으로 기억한다", async () => {
  server.use(
    http.get(`${API}/stations`, () => HttpResponse.json([{ id: 222, name: "강남", lines: ["2호선"], line: "2호선" }])),
    http.post(`${API}/rooms/abc123/participants`, () =>
      HttpResponse.json(participant({ id: 9, nickname: "지은" }), { status: 201 }),
    ),
  );
  const user = userEvent.setup();
  renderWithClient(<JoinScreen source="link" slug="abc123" room={room()} onShowResult={vi.fn()} />);
  await user.type(screen.getByLabelText("닉네임"), "지은");
  await user.type(screen.getByLabelText("출발지 검색"), "강남");
  await user.click(await screen.findByRole("button", { name: /강남/ }));
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));
  await waitFor(() => expect(window.localStorage.getItem("wjm:room:abc123:mine")).toBe("[9]"));
});

test("공유창으로 초대 링크를 보내면 join으로 남긴다", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  try {
    renderWithClient(<JoinScreen source="link" slug="abc123" room={room()} onShowResult={vi.fn()} />);
    vi.mocked(track).mockClear();
    await userEvent.click(await screen.findByRole("button", { name: "공유하기" }));
    expect(share).toHaveBeenCalledWith({ title: room().title, url: `${window.location.origin}/r/abc123` });
    await waitFor(() => expect(track).toHaveBeenCalledWith("link_shared", { place: "join" }));
  } finally {
    Reflect.deleteProperty(navigator, "share");
  }
});

test("한 명 이하면 초대 안내와 함께 링크 복사 버튼을 보여준다", async () => {
  const user = userEvent.setup();
  renderWithClient(<JoinScreen source="link" slug="abc123" room={room({ participants: [TWO[0]] })} onShowResult={vi.fn()} />);
  const hint = screen.getByText("친구를 초대하세요. 두 명부터 추천이 나와요.");
  await user.click(within(hint.parentElement as HTMLElement).getByRole("button", { name: "초대 링크 복사" }));
  expect(await screen.findByText("링크를 복사했어요")).toBeInTheDocument();
});

test("화면이 처음 열릴 때 한 번만 통계를 남기고, 다시 그려져도 반복하지 않는다", () => {
  const { rerender } = renderWithClient(
    <JoinScreen source="link" slug="abc123" room={room({ participants: TWO })} onShowResult={vi.fn()} />,
  );
  expect(track).toHaveBeenCalledExactlyOnceWith("join_viewed", { participant_count: 2, source: "link" });
  // 폴링으로 방이 새로 와도 다시 남기지 않는다.
  rerender(
    <JoinScreen source="link"
      slug="abc123"
      room={room({ participants: [...TWO, participant({ id: 3, nickname: "지은", active: false })] })}
      onShowResult={vi.fn()}
    />,
  );
  expect(track).toHaveBeenCalledOnce();
});

test("역으로 등록하면 방법과 등록 뒤 인원을 통계로 남긴다", async () => {
  server.use(
    http.get(`${API}/stations`, () => HttpResponse.json([{ id: 222, name: "강남", lines: ["2호선"], line: "2호선" }])),
    http.post(`${API}/rooms/abc123/participants`, () =>
      HttpResponse.json(participant({ id: 9, nickname: "지은" }), { status: 201 }),
    ),
  );
  const user = userEvent.setup();
  renderWithClient(<JoinScreen source="link" slug="abc123" room={room({ participants: TWO })} onShowResult={vi.fn()} />);
  await user.type(screen.getByLabelText("닉네임"), "지은");
  await user.type(screen.getByLabelText("출발지 검색"), "강남");
  await user.click(await screen.findByRole("button", { name: /강남/ }));
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));
  await waitFor(() =>
    expect(track).toHaveBeenCalledWith("participant_added", { method: "station", participant_count: 3 }),
  );
});

test("주소로 등록하면 address로 남기고, 등록이 실패하면 남기지 않는다", async () => {
  server.use(
    http.post(`${API}/places/search`, () =>
      HttpResponse.json({ items: [{ name: "우리집", address: "서울 어딘가 1" }], error: null }),
    ),
    http.post(`${API}/rooms/abc123/participants`, () =>
      HttpResponse.json({ detail: "주소를 찾지 못했어요. 역을 직접 골라주세요." }, { status: 422 }),
    ),
  );
  const user = userEvent.setup();
  renderWithClient(<JoinScreen source="link" slug="abc123" room={room()} onShowResult={vi.fn()} />);
  await user.type(screen.getByLabelText("닉네임"), "지은");
  await user.click(screen.getByRole("tab", { name: "주소, 건물명 검색" }));
  await user.type(screen.getByLabelText("출발지 검색"), "우리집");
  await user.click(await screen.findByRole("button", { name: /우리집/ }));
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("주소를 찾지 못했어요");
  expect(track).not.toHaveBeenCalledWith("participant_added", expect.anything());

  server.use(
    http.post(`${API}/rooms/abc123/participants`, () =>
      HttpResponse.json(participant({ id: 9, nickname: "지은" }), { status: 201 }),
    ),
  );
  await user.click(screen.getByRole("tab", { name: "주소, 건물명 검색" }));
  await user.type(screen.getByLabelText("출발지 검색"), "우리집");
  await user.click(await screen.findByRole("button", { name: /우리집/ }));
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));
  await waitFor(() =>
    expect(track).toHaveBeenCalledWith("participant_added", { method: "address", participant_count: 1 }),
  );
});

test("초대 링크를 복사하면 join으로 남기고, 복사에 실패하면 남기지 않는다", async () => {
  const user = userEvent.setup();
  renderWithClient(<JoinScreen source="link" slug="abc123" room={room({ participants: TWO })} onShowResult={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "초대 링크 복사" }));
  await screen.findByText("링크를 복사했어요");
  expect(track).toHaveBeenCalledWith("link_copied", { place: "join" });

  vi.mocked(track).mockClear();
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
  await user.click(screen.getByRole("button", { name: "초대 링크 복사" }));
  await screen.findByText("복사하지 못했어요. 주소창의 링크를 직접 복사해주세요.");
  expect(track).not.toHaveBeenCalled();
});

test("링크로 들어와도 사용법은 저절로 뜨지 않고 사용법 보기를 눌렀을 때만 연다", async () => {
  const user = userEvent.setup();
  renderWithClient(
    <TourProvider>
      <JoinScreen source="link" slug="abc123" room={room()} onShowResult={vi.fn()} />
    </TourProvider>,
  );
  expect(await screen.findByText("출발지 등록", { selector: "h2" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).toBeNull();

  await user.click(screen.getByRole("button", { name: "사용법 보기" }));
  expect(screen.getByRole("dialog", { name: "1. 내 출발지를 넣어요" })).toBeInTheDocument();
});
