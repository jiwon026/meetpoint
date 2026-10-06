import { focusManager } from "@tanstack/react-query";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";
import { NO_FILTER } from "@/lib/filter";
import { API, rec, result } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { HubScreen } from "./HubScreen";

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
const EVENT = {
  id: "e1",
  title: "양재천 봄 음악회",
  place: "양재천 야외무대",
  start_date: "2026-10-09",
  end_date: "2026-10-11",
  lat: 37.48,
  lng: 127.04,
  url: "https://example.org/e1",
  image: "",
  category: "음악",
  is_free: true,
  distance_m: 600,
};

function serveResult(theme: string | null = null) {
  server.use(http.get(`${API}/rooms/abc123/result`, () => HttpResponse.json(result({ theme, recommendations: [rec()] }))));
}

function serveContent(handler: (kind: string) => Response) {
  const kinds: string[] = [];
  server.use(
    http.get(`${API}/rooms/abc123/hubs/1/content`, ({ request }) => {
      const kind = new URL(request.url).searchParams.get("kind") ?? "";
      kinds.push(kind);
      return handler(kind);
    }),
  );
  return kinds;
}

function show(onGone = vi.fn(), hubId = 1) {
  renderWithClient(<HubScreen slug="abc123" hubId={hubId} filter={NO_FILTER} onGone={onGone} />);
  return onGone;
}

test("거점 정보와 테마에 맞는 탭의 장소를 보여준다", async () => {
  serveResult("cafe");
  const kinds = serveContent((kind) => HttpResponse.json({ kind, items: [PLACE], error: null }));
  show();
  expect(await screen.findByRole("heading", { name: "양재" })).toBeInTheDocument();
  expect(screen.getByText("반경 600m")).toBeInTheDocument();
  expect(await screen.findByText("양재 국밥집")).toBeInTheDocument();
  expect(kinds).toEqual(["cafe"]);
  expect(screen.getByRole("tab", { name: "카페" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("도보 약 4분")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "카카오맵에서 별점, 리뷰 보기" })).toHaveAttribute("href", PLACE.url);
});

test("테마가 없으면 맛집 탭부터, 탭을 바꾸면 그 종류를 한 번 불러온다", async () => {
  serveResult();
  const kinds = serveContent((kind) =>
    HttpResponse.json({ kind, items: kind === "event" ? [EVENT] : [PLACE], error: null }),
  );
  show();
  await screen.findByText("양재 국밥집");
  await userEvent.click(screen.getByRole("tab", { name: "행사" }));
  expect(await screen.findByText("양재천 봄 음악회")).toBeInTheDocument();
  expect(screen.getByText("무료")).toBeInTheDocument();
  expect(screen.getByText("2026-10-09 ~ 2026-10-11")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "맛집" }));
  await screen.findByText("양재 국밥집");
  expect(kinds).toEqual(["food", "event"]);
});

test("에러 문구와 묵은 목록이 같이 오면 둘 다 보여준다", async () => {
  serveResult();
  serveContent((kind) => HttpResponse.json({ kind, items: [PLACE], error: "지금 불러올 수 없어요" }));
  show();
  expect(await screen.findByText("지금 불러올 수 없어요")).toBeInTheDocument();
  expect(screen.getByText("양재 국밥집")).toBeInTheDocument();
});

test("에러만 오면 문구만 보여준다", async () => {
  serveResult();
  serveContent((kind) => HttpResponse.json({ kind, items: [], error: "지금 불러올 수 없어요" }));
  show();
  expect(await screen.findByText("지금 불러올 수 없어요")).toBeInTheDocument();
  expect(screen.queryByText("근처에서 찾지 못했어요")).toBeNull();
});

test("결과가 없으면 못 찾았다고 알린다", async () => {
  serveResult();
  serveContent((kind) => HttpResponse.json({ kind, items: [], error: null }));
  show();
  expect(await screen.findByText("근처에서 찾지 못했어요")).toBeInTheDocument();
});

test("추천 목록에 없는 거점이면 onGone을 한 번 부른다", async () => {
  serveResult();
  const kinds = serveContent((kind) => HttpResponse.json({ kind, items: [], error: null }));
  const onGone = show(vi.fn(), 999);
  await waitFor(() => expect(onGone).toHaveBeenCalledOnce());
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(onGone).toHaveBeenCalledOnce();
  expect(kinds).toEqual([]);
});

test("콘텐츠 API가 404면 onGone을 부른다", async () => {
  serveResult();
  serveContent(() => HttpResponse.json({ detail: "거점을 찾을 수 없어요" }, { status: 404 }));
  const onGone = show();
  await waitFor(() => expect(onGone).toHaveBeenCalledOnce());
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(onGone).toHaveBeenCalledOnce();
});

test("거점을 불러온 뒤 재조회가 실패해도 제목과 탭이 남는다", async () => {
  serveResult();
  serveContent((kind) => HttpResponse.json({ kind, items: [PLACE], error: null }));
  show();
  expect(await screen.findByRole("heading", { name: "양재" })).toBeInTheDocument();

  let failedCalls = 0;
  server.use(
    http.get(`${API}/rooms/abc123/result`, () => {
      failedCalls += 1;
      return HttpResponse.json({ detail: "서버에 문제가 생겼어요" }, { status: 500 });
    }),
  );
  try {
    act(() => focusManager.setFocused(false));
    act(() => focusManager.setFocused(true));
    await waitFor(() => expect(failedCalls).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole("heading", { name: "양재" })).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  } finally {
    act(() => focusManager.setFocused(undefined));
  }
});


function serveContentUrls() {
  const urls: URL[] = [];
  server.use(
    http.get(`${API}/rooms/abc123/hubs/1/content`, ({ request }) => {
      const url = new URL(request.url);
      urls.push(url);
      const sort = url.searchParams.get("sort");
      const name = sort === "distance" ? "역 앞 김밥집" : "소문난 한정식";
      return HttpResponse.json({ kind: url.searchParams.get("kind"), items: [{ ...PLACE, name }], error: null });
    }),
  );
  return urls;
}

test("맛집은 추천순으로 먼저 보여주고, 가까운 순으로 바꾸면 다시 불러온다", async () => {
  serveResult();
  const urls = serveContentUrls();
  show();
  expect(await screen.findByText("소문난 한정식")).toBeInTheDocument();
  expect(urls[0].searchParams.get("sort")).toBe("recommended");
  expect(screen.getByRole("button", { name: "추천순" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: "가까운 순" }));
  expect(await screen.findByText("역 앞 김밥집")).toBeInTheDocument();
  expect(urls.map((u) => u.searchParams.get("sort"))).toEqual(["recommended", "distance"]);
  expect(screen.getByRole("button", { name: "가까운 순" })).toHaveAttribute("aria-pressed", "true");
  // 이미 받은 정렬로 돌아가면 다시 부르지 않는다.
  await userEvent.click(screen.getByRole("button", { name: "추천순" }));
  expect(await screen.findByText("소문난 한정식")).toBeInTheDocument();
  expect(urls).toHaveLength(2);
});

test("정렬은 맛집과 카페 탭에만 있고, 고른 정렬은 탭을 옮겨도 유지된다", async () => {
  serveResult();
  const urls = serveContentUrls();
  show();
  await screen.findByText("소문난 한정식");
  await userEvent.click(screen.getByRole("button", { name: "가까운 순" }));
  await screen.findByText("역 앞 김밥집");
  await userEvent.click(screen.getByRole("tab", { name: "놀거리" }));
  await waitFor(() => expect(urls.at(-1)?.searchParams.get("kind")).toBe("play"));
  expect(screen.queryByRole("button", { name: "추천순" })).toBeNull();
  expect(urls.at(-1)?.searchParams.has("sort")).toBe(false);
  await userEvent.click(screen.getByRole("tab", { name: "카페" }));
  await waitFor(() => expect(urls.at(-1)?.searchParams.get("kind")).toBe("cafe"));
  expect(urls.at(-1)?.searchParams.get("sort")).toBe("distance");
  expect(screen.getByRole("button", { name: "가까운 순" })).toHaveAttribute("aria-pressed", "true");
});
