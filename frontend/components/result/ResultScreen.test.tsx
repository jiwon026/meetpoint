import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";
import type { ResultOut } from "@/lib/api/types";
import { track } from "@/lib/analytics";
import { NO_FILTER } from "@/lib/filter";
import { API, leg, rec, result } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { ResultScreen } from "./ResultScreen";

function serve(body: ResultOut) {
  server.use(http.get(`${API}/rooms/abc123/result`, () => HttpResponse.json(body)));
}

function show(props: Partial<Parameters<typeof ResultScreen>[0]> = {}) {
  return renderWithClient(
    <ResultScreen slug="abc123" filter={NO_FILTER} onFilterChange={vi.fn()} onAddPeople={vi.fn()} {...props} />,
  );
}

const TWO_HUBS = [
  rec({ hub_id: 1, name: "양재" }),
  rec({ hub_id: 2, name: "교대", region: "서울", max_minutes: 25, spread_minutes: 12, lines: ["2호선", "3호선"] }),
];

test("1위 카드가 펼쳐진 채로 시작하고 다른 카드를 누르면 그 카드가 펼쳐진다", async () => {
  serve(result({ recommendations: TWO_HUBS }));
  show();
  expect(screen.getByText("불러오는 중이에요")).toBeInTheDocument();
  const cards = await screen.findAllByTestId("hub-card");
  expect(cards).toHaveLength(2);
  expect(within(cards[0]).getByRole("button", { expanded: true })).toBeInTheDocument();
  expect(within(cards[0]).getByText("1위")).toBeInTheDocument();
  expect(within(cards[1]).getByRole("button", { expanded: false })).toBeInTheDocument();
  expect(within(cards[1]).getByTestId("hub-summary")).toHaveTextContent("서울, 최대 약 25분, 차이 12분");
  expect(screen.getByText(/지하철 이동 시간 기준이에요/)).toBeInTheDocument();

  await userEvent.click(within(cards[1]).getByRole("button", { expanded: false }));
  expect(within(cards[1]).getByRole("button", { expanded: true })).toBeInTheDocument();
  expect(within(cards[0]).getByRole("button", { expanded: false })).toBeInTheDocument();
});

test("펼친 카드는 수치, 사람별 시간, 둘러보기 링크를 보여준다", async () => {
  serve(result({ recommendations: TWO_HUBS }));
  show({ filter: { regions: ["서울"], themes: ["cafe"] } });
  const card = (await screen.findAllByTestId("hub-card"))[0];
  expect(within(card).getByText("어디서든 오기 쉬운 교통 중심")).toBeInTheDocument();
  expect(within(card).getByText("평균")).toBeInTheDocument();
  expect(within(card).getByText("약 17분")).toBeInTheDocument();
  expect(within(card).getByRole("link", { name: "이 동네 둘러보기" })).toHaveAttribute(
    "href",
    "/r/abc123/hubs/1?region=%EC%84%9C%EC%9A%B8&theme=cafe",
  );
});

test("테마 도장과 가장 빠른 곳보다 얼마나 더 걸리는지 보여준다", async () => {
  serve(
    result({
      theme: "cafe",
      best_max_minutes: 22,
      recommendations: [rec({ hub_id: 2, name: "교대", max_minutes: 25, theme_match: true }), rec({ hub_id: 1 })],
    }),
  );
  show();
  const card = (await screen.findAllByTestId("hub-card"))[0];
  expect(within(card).getByText("테마에 맞아요")).toBeInTheDocument();
  expect(within(card).getByText("가장 빠른 곳보다 3분 더")).toBeInTheDocument();
});

test("대기 상태면 초대 안내와 사람 추가", async () => {
  serve(result({ status: "waiting", recommendations: [], best_max_minutes: null }));
  const onAddPeople = vi.fn();
  show({ onAddPeople });
  expect(await screen.findByText("친구를 초대하세요. 두 명부터 추천이 나와요.")).toBeInTheDocument();
  expect(screen.queryByTestId("hub-card")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "사람 추가" }));
  expect(onAddPeople).toHaveBeenCalledOnce();
});

test("지역을 좁혀서 추천이 없으면 지역을 넓히라고 안내한다", async () => {
  serve(result({ recommendations: [], best_max_minutes: null, regions: ["인천"] }));
  show({ filter: { regions: ["인천"], themes: null } });
  expect(await screen.findByText("이 지역엔 추천할 곳이 없어요. 지역을 넓혀보세요.")).toBeInTheDocument();
  expect(screen.queryByText(/지하철 이동 시간 기준이에요/)).toBeNull();
  // 필터는 그대로 보여서 다시 넓힐 수 있어야 한다
  expect(screen.getByRole("button", { name: "서울" })).toBeInTheDocument();
});

test("전체 지역인데 추천이 없으면 계산 실패 안내", async () => {
  serve(result({ recommendations: [], best_max_minutes: null }));
  show();
  expect(await screen.findByText("경로를 계산하지 못했어요. 방을 새로 만들어 다시 시도해주세요.")).toBeInTheDocument();
});

test("이동시간이 빠진 카드는 안내 문구로 대신한다", async () => {
  serve(result({ recommendations: [rec({ legs: [] })] }));
  show();
  const card = (await screen.findAllByTestId("hub-card"))[0];
  expect(within(card).getByText("이동시간을 불러오지 못했어요")).toBeInTheDocument();
  expect(within(card).queryByTestId("leg-bar")).toBeNull();
});

test("내가 넣은 사람에게 '나'를 붙인다", async () => {
  window.localStorage.setItem("wjm:room:abc123:mine", "[2]");
  serve(result({ recommendations: [rec({ legs: [leg(), leg({ participant_id: 2, nickname: "수진", minutes: 22 })] })] }));
  show();
  await screen.findAllByTestId("hub-card");
  expect(screen.getByText("나")).toBeInTheDocument();
});

test("필터 칩을 누르면 바뀐 필터를 넘긴다", async () => {
  serve(result({ recommendations: TWO_HUBS }));
  const onFilterChange = vi.fn();
  show({ onFilterChange });
  await screen.findAllByTestId("hub-card");
  await userEvent.click(screen.getByRole("button", { name: "경기" }));
  expect(onFilterChange).toHaveBeenLastCalledWith({ regions: ["서울", "인천"], themes: null });
});

test("만료된 방이면 백엔드 문구와 새 방 만들기", async () => {
  server.use(
    http.get(`${API}/rooms/abc123/result`, () => HttpResponse.json({ detail: "약속이 지난 방이에요" }, { status: 410 })),
  );
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent("약속이 지난 방이에요");
  expect(screen.getByRole("link", { name: "새 방 만들기" })).toHaveAttribute("href", "/");
});

test("결과 링크 복사는 필터가 붙은 주소를 복사한다", async () => {
  serve(result({ recommendations: TWO_HUBS }));
  const user = userEvent.setup();
  show({ filter: { regions: null, themes: ["cafe", "drink"] } });
  await screen.findAllByTestId("hub-card");
  await user.click(screen.getByRole("button", { name: "결과 링크 복사" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("링크를 복사했어요"));
  expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/r/abc123/result?theme=cafe&theme=drink`);
});

test("준비된 결과를 처음 보여줄 때 한 번만 통계를 남기고, 다시 불러와도 반복하지 않는다", async () => {
  serve(result({ recommendations: TWO_HUBS, themes: ["cafe", "drink"], regions: ["서울", "경기"] }));
  const { rerender } = show();
  await screen.findAllByTestId("hub-card");
  expect(track).toHaveBeenCalledExactlyOnceWith("result_viewed", {
    participant_count: 2,
    regions: "서울,경기",
    theme: "cafe,drink",
    recommendation_count: 2,
  });

  // 필터를 바꿔 다른 결과가 와도 같은 화면이므로 다시 남기지 않는다.
  serve(result({ recommendations: [TWO_HUBS[1]], themes: [], regions: ["서울"] }));
  rerender(
    <ResultScreen
      slug="abc123"
      filter={{ regions: ["서울"], themes: null }}
      onFilterChange={vi.fn()}
      onAddPeople={vi.fn()}
    />,
  );
  await waitFor(() => expect(screen.getAllByTestId("hub-card")).toHaveLength(1));
  expect(vi.mocked(track).mock.calls.filter(([event]) => event === "result_viewed")).toHaveLength(1);
});

test("대기 상태에서는 결과 통계를 남기지 않는다", async () => {
  serve(result({ status: "waiting", recommendations: [], best_max_minutes: null }));
  show();
  await screen.findByText("친구를 초대하세요. 두 명부터 추천이 나와요.");
  expect(track).not.toHaveBeenCalled();
});

test("테마가 없는 결과는 theme을 none으로 남긴다", async () => {
  serve(result({ recommendations: [rec()], themes: [] }));
  show();
  await screen.findAllByTestId("hub-card");
  expect(track).toHaveBeenCalledWith("result_viewed", expect.objectContaining({ theme: "none", recommendation_count: 1 }));
});

test("다른 카드를 펼칠 때만 그 카드의 순위를 남긴다", async () => {
  serve(result({ recommendations: TWO_HUBS }));
  show();
  const cards = await screen.findAllByTestId("hub-card");
  vi.mocked(track).mockClear();
  // 이미 펼쳐진 1위 카드를 누르는 것은 새로 여는 것이 아니다.
  await userEvent.click(within(cards[0]).getByRole("button", { expanded: true }));
  expect(track).not.toHaveBeenCalled();
  await userEvent.click(within(cards[1]).getByRole("button", { expanded: false }));
  expect(track).toHaveBeenCalledExactlyOnceWith("hub_card_opened", { rank: 2 });
});

test("길찾기 링크를 누르면 그 카드의 순위를 남긴다", async () => {
  serve(result({ recommendations: TWO_HUBS }));
  show();
  const cards = await screen.findAllByTestId("hub-card");
  await userEvent.click(within(cards[0]).getByRole("link", { name: "민수 길찾기" }));
  expect(track).toHaveBeenCalledWith("directions_clicked", { rank: 1 });
  await userEvent.click(within(cards[1]).getByRole("button", { expanded: false }));
  await userEvent.click(within(cards[1]).getByRole("link", { name: "수진 길찾기" }));
  expect(track).toHaveBeenLastCalledWith("directions_clicked", { rank: 2 });
});

test("결과 링크를 복사하면 result로 남기고, 대기 화면의 초대 링크 복사도 result", async () => {
  serve(result({ recommendations: TWO_HUBS }));
  const user = userEvent.setup();
  const { unmount } = show();
  await screen.findAllByTestId("hub-card");
  await user.click(screen.getByRole("button", { name: "결과 링크 복사" }));
  await waitFor(() => expect(track).toHaveBeenCalledWith("link_copied", { place: "result" }));
  unmount();

  vi.mocked(track).mockClear();
  serve(result({ status: "waiting", recommendations: [], best_max_minutes: null }));
  show();
  await user.click(await screen.findByRole("button", { name: "초대 링크 복사" }));
  await waitFor(() => expect(track).toHaveBeenCalledWith("link_copied", { place: "result" }));
});
