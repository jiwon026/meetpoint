import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, test, vi } from "vitest";
import { JoinScreen } from "@/components/join/JoinScreen";
import { HubScreen } from "@/components/hub/HubScreen";
import { ResultScreen } from "@/components/result/ResultScreen";
import { track } from "@/lib/analytics";
import { NO_FILTER } from "@/lib/filter";
import { API, leg, participant, rec, result, room } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { markTourSeen } from "@/lib/tour";

beforeEach(() => {
  markTourSeen("join");
});

// 이 테스트에서만 쓰는 값. 통계에 하나라도 섞이면 실패해야 한다.
const SLUG = "zq7x4kmp";
const NICKNAME = "별빛토끼";
const ORIGIN_STATION = "합정";
const ADDRESS = "서울 마포구 양화로 45";

const PLACE = {
  id: "100",
  name: "양재 국밥집",
  category: "국밥",
  address: "서울 서초구 강남대로 1",
  distance_m: 210,
  url: "https://place.map.kakao.com/100",
  lat: 37.485,
  lng: 127.035,
};

test("방 입장부터 결과와 주변 화면까지 어떤 통계에도 닉네임, 출발역, 주소, 방 링크가 들어가지 않는다", async () => {
  const legs = [
    leg({ participant_id: 1, nickname: "민수", origin_station_name: "강남" }),
    leg({ participant_id: 9, nickname: NICKNAME, origin_station_name: ORIGIN_STATION, minutes: 30 }),
  ];
  server.use(
    http.get(`${API}/stations`, () => HttpResponse.json([{ id: 222, name: ORIGIN_STATION, lines: ["2호선"], line: "2호선" }])),
    http.post(`${API}/places/search`, () =>
      HttpResponse.json({ items: [{ name: "우리집", address: ADDRESS }], error: null }),
    ),
    http.post(`${API}/rooms/${SLUG}/participants`, () =>
      HttpResponse.json(participant({ id: 9, nickname: NICKNAME, nearest_station_name: ORIGIN_STATION }), {
        status: 201,
      }),
    ),
    http.get(`${API}/rooms/${SLUG}/result`, () =>
      HttpResponse.json(
        result({ recommendations: [rec({ hub_id: 1, name: "양재", legs }), rec({ hub_id: 2, name: "교대", legs })] }),
      ),
    ),
    http.get(`${API}/rooms/${SLUG}/hubs/1/content`, ({ request }) =>
      HttpResponse.json({ kind: new URL(request.url).searchParams.get("kind"), items: [PLACE], error: null }),
    ),
  );
  const user = userEvent.setup();

  // 1. 입장하고 역으로, 다음엔 주소로 등록하고 링크를 복사한다.
  const join = renderWithClient(
    <JoinScreen slug={SLUG} room={room({ slug: SLUG, participants: [participant()] })} onShowResult={vi.fn()} />,
  );
  await user.type(screen.getByLabelText("닉네임"), NICKNAME);
  await user.type(screen.getByLabelText("출발지 검색"), ORIGIN_STATION);
  await user.click(await screen.findByRole("button", { name: new RegExp(ORIGIN_STATION) }));
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));
  await waitFor(() => expect(track).toHaveBeenCalledWith("participant_added", expect.objectContaining({ method: "station" })));
  await user.type(screen.getByLabelText("닉네임"), NICKNAME);
  await user.click(screen.getByRole("tab", { name: "주소, 건물명 검색" }));
  await user.type(screen.getByLabelText("출발지 검색"), ADDRESS);
  await user.click(await screen.findByRole("button", { name: /우리집/ }));
  await user.click(screen.getByRole("button", { name: "출발지 등록" }));
  await waitFor(() => expect(track).toHaveBeenCalledWith("participant_added", expect.objectContaining({ method: "address" })));
  await user.click(screen.getAllByRole("button", { name: "초대 링크 복사" })[0]);
  await waitFor(() => expect(track).toHaveBeenCalledWith("link_copied", { place: "join" }));
  join.unmount();

  // 2. 결과를 보고 필터를 바꾸고 카드를 펼치고 길찾기와 링크 복사를 누른다.
  const onFilterChange = vi.fn();
  const resultView = renderWithClient(
    <ResultScreen slug={SLUG} filter={NO_FILTER} onFilterChange={onFilterChange} onAddPeople={vi.fn()} />,
  );
  const cards = await screen.findAllByTestId("hub-card");
  await user.click(screen.getByRole("button", { name: "카페" }));
  await user.click(within(cards[0]).getByRole("link", { name: `${NICKNAME} 길찾기` }));
  await user.click(within(cards[1]).getByRole("button", { expanded: false }));
  await user.click(screen.getByRole("button", { name: "결과 링크 복사" }));
  await waitFor(() => expect(track).toHaveBeenCalledWith("link_copied", { place: "result" }));
  resultView.unmount();

  // 3. 동네 화면에서 탭, 정렬, 장소 링크를 누른다.
  renderWithClient(<HubScreen slug={SLUG} hubId={1} filter={NO_FILTER} onGone={vi.fn()} />);
  await screen.findByText("양재 국밥집");
  await user.click(screen.getByRole("button", { name: "가까운 순" }));
  await user.click(await screen.findByRole("link", { name: "카카오맵에서 별점, 리뷰 보기" }));
  await user.click(screen.getByRole("tab", { name: "카페" }));

  const events = vi.mocked(track).mock.calls.map(([event]) => event);
  for (const expected of [
    "join_viewed",
    "participant_added",
    "link_copied",
    "result_viewed",
    "result_filter_changed",
    "hub_card_opened",
    "directions_clicked",
    "hub_viewed",
    "content_tab_selected",
    "place_sort_changed",
    "place_link_clicked",
  ]) {
    expect(events).toContain(expected);
  }

  const sent = JSON.stringify(vi.mocked(track).mock.calls);
  for (const secret of [NICKNAME, ORIGIN_STATION, ADDRESS, "우리집", SLUG, "강남", "민수", "/r/"]) {
    expect(sent).not.toContain(secret);
  }
}, 20_000);
