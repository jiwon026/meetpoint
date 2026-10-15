import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { API, room } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { RoomSummary } from "./RoomSummary";

const NOW = new Date(2026, 9, 6);

test("이름, 한 줄 설명, 날짜, D-day, 지역, 테마, 자동 삭제 안내를 보여준다", () => {
  render(
    <RoomSummary
      room={room({ title: "금요일 저녁", meet_date: "2026-10-10", regions: ["서울", "경기"], themes: ["food", "drink"] })}
      now={NOW}
    />,
  );
  expect(screen.getByRole("heading", { name: "금요일 저녁" })).toBeInTheDocument();
  expect(screen.getByText("각자 출발지를 넣으면 모두에게 공평한 만남 장소를 추천해요.")).toBeInTheDocument();
  expect(screen.getByText("10월 10일 (토)")).toBeInTheDocument();
  expect(screen.getByText("D-4")).toBeInTheDocument();
  expect(screen.getByText("서울, 경기, 맛집, 술자리")).toBeInTheDocument();
  expect(screen.getByText("약속 7일 뒤 자동 삭제")).toBeInTheDocument();
  // slug가 없으면 날짜를 바꿀 수 없다.
  expect(screen.queryByRole("button", { name: "하루 뒤" })).toBeNull();
});

function patchHandler(bodies: unknown[]) {
  return http.patch(`${API}/rooms/abc123`, async ({ request }) => {
    const body = (await request.json()) as { meet_date: string; title?: string };
    bodies.push(body);
    return HttpResponse.json(room({ meet_date: body.meet_date, title: body.title ?? "금요일 저녁" }));
  });
}

test("화면에서 바로 하루씩 옮기고, 여러 번 눌러도 마지막 날짜만 한 번 저장한다. 사람이 붙인 이름은 그대로 둔다", async () => {
  const bodies: unknown[] = [];
  server.use(patchHandler(bodies));
  const user = userEvent.setup();
  renderWithClient(<RoomSummary room={room({ title: "금요일 저녁", meet_date: "2026-10-10" })} slug="abc123" now={NOW} />);

  await user.click(screen.getByRole("button", { name: "하루 뒤" }));
  await user.click(screen.getByRole("button", { name: "하루 뒤" }));
  // 저장을 기다리는 동안에도 고른 날짜와 D-day가 바로 보인다.
  expect(screen.getByText("10월 12일 (월)")).toBeInTheDocument();
  expect(screen.getByText("D-6")).toBeInTheDocument();
  expect(screen.getByText("저장하는 중")).toBeInTheDocument();

  await waitFor(() => expect(bodies).toEqual([{ meet_date: "2026-10-12" }]));
});

test("날짜로 지은 이름이면 날짜를 바꿀 때 이름도 새 날짜로 바꾼다", async () => {
  const bodies: unknown[] = [];
  server.use(patchHandler(bodies));
  const user = userEvent.setup();
  renderWithClient(
    <RoomSummary room={room({ title: "10월 10일 (토) 모임", meet_date: "2026-10-10" })} slug="abc123" now={NOW} />,
  );
  await user.click(screen.getByRole("button", { name: "하루 뒤" }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).toEqual({ meet_date: "2026-10-11", title: "10월 11일 (일) 모임" });
});

test("원래 날짜로 돌아오면 보내지 않는다", async () => {
  const bodies: unknown[] = [];
  server.use(patchHandler(bodies));
  const user = userEvent.setup();
  renderWithClient(<RoomSummary room={room({ meet_date: "2026-10-10" })} slug="abc123" now={NOW} />);
  await user.click(screen.getByRole("button", { name: "하루 뒤" }));
  await user.click(screen.getByRole("button", { name: "하루 전" }));
  expect(screen.queryByText("저장하는 중")).toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 800));
  expect(bodies).toEqual([]);
});

test("저장에 실패하면 백엔드 문구를 보여주고 원래 날짜로 돌아간다", async () => {
  server.use(
    http.patch(`${API}/rooms/abc123`, () =>
      HttpResponse.json({ detail: "요청이 너무 많아요. 잠시 후 다시 시도해주세요." }, { status: 429 }),
    ),
  );
  const user = userEvent.setup();
  renderWithClient(<RoomSummary room={room({ meet_date: "2026-10-10" })} slug="abc123" now={NOW} />);
  await user.click(screen.getByRole("button", { name: "하루 뒤" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("요청이 너무 많아요. 잠시 후 다시 시도해주세요.");
  expect(screen.getByText("10월 10일 (토)")).toBeInTheDocument();
});
