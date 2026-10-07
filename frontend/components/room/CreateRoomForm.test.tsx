import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";
import { track } from "@/lib/analytics";
import { API, room } from "@/lib/test/fixtures";
import { renderWithClient } from "@/lib/test/render";
import { server } from "@/lib/test/server";
import { CreateRoomForm } from "./CreateRoomForm";

const TODAY = "2026-10-02";

function fill(title: string, date: string, regions: string[] = ["서울", "경기", "인천"]) {
  fireEvent.change(screen.getByLabelText("모임 이름"), { target: { value: title } });
  fireEvent.change(screen.getByLabelText("약속 날짜"), { target: { value: date } });
  for (const region of regions) {
    fireEvent.click(screen.getByRole("button", { name: region }));
  }
}

test("기본은 지역도 테마도 고르지 않은 상태", () => {
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  for (const region of ["서울", "경기", "인천"]) {
    expect(screen.getByRole("button", { name: region })).toHaveAttribute("aria-pressed", "false");
  }
  expect(screen.getByRole("button", { name: /맛집/ })).toHaveAttribute("aria-pressed", "false");
});

test("지역을 고르지 않으면 요청하지 않고 안내한다", async () => {
  let posts = 0;
  server.use(
    http.post(`${API}/rooms`, () => {
      posts += 1;
      return HttpResponse.json(room({ slug: "k3x9pq" }), { status: 201 });
    }),
  );
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  fill("금요일 저녁", "2026-10-10", []);
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  expect(screen.getByRole("alert")).toHaveTextContent("만날 지역을 하나 이상 골라주세요");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(posts).toBe(0);
});

test("이름이 없으면 요청하지 않고 안내한다", async () => {
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  fill("   ", "2026-10-10");
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  expect(screen.getByRole("alert")).toHaveTextContent("모임 이름을 적어주세요");
});

test("지난 날짜는 요청하지 않고 안내한다", async () => {
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  fill("금요일 저녁", "2026-10-01");
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  expect(screen.getByRole("alert")).toHaveTextContent("오늘 이후 날짜를 골라주세요");
});

test("1년 넘는 날짜는 요청하지 않고 안내한다", async () => {
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  fill("금요일 저녁", "2027-10-03");
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  expect(screen.getByRole("alert")).toHaveTextContent("약속 날짜는 1년 안으로 골라주세요");
});

test("날짜 입력에 오늘과 1년 뒤를 범위로 건다", () => {
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  const input = screen.getByLabelText("약속 날짜");
  expect(input).toHaveAttribute("min", "2026-10-02");
  expect(input).toHaveAttribute("max", "2027-10-02");
});

test("고른 지역과 테마를 보내고 만든 방을 넘긴다", async () => {
  let body: unknown = null;
  server.use(
    http.post(`${API}/rooms`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(room({ slug: "k3x9pq" }), { status: 201 });
    }),
  );
  const onCreated = vi.fn();
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={onCreated} />);
  fill("  금요일 저녁 ", "2026-10-10");
  await userEvent.click(screen.getByRole("button", { name: "경기" }));
  await userEvent.click(screen.getByRole("button", { name: /술자리/ }));
  await userEvent.click(screen.getByRole("button", { name: /카페/ }));
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  expect(onCreated.mock.calls[0][0].slug).toBe("k3x9pq");
  expect(body).toEqual({ title: "금요일 저녁", meet_date: "2026-10-10", regions: ["서울", "인천"], themes: ["cafe", "drink"] });
});

test("서버 문구를 그대로 보여준다", async () => {
  server.use(http.post(`${API}/rooms`, () => HttpResponse.json({ detail: [{ msg: "x" }] }, { status: 422 })));
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  fill("금요일 저녁", "2026-10-10");
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("입력을 다시 확인해주세요");
});

test("성공 뒤에는 버튼이 비활성이라 다시 눌러도 요청은 한 번", async () => {
  let posts = 0;
  server.use(
    http.post(`${API}/rooms`, () => {
      posts += 1;
      return HttpResponse.json(room({ slug: "k3x9pq" }), { status: 201 });
    }),
  );
  const onCreated = vi.fn();
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={onCreated} />);
  fill("금요일 저녁", "2026-10-10");
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  const button = screen.getByRole("button", { name: "만드는 중" });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  await userEvent.click(button);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(posts).toBe(1);
  expect(onCreated).toHaveBeenCalledOnce();
});

test("만들기가 4초 넘게 걸리면 서버를 깨우는 중이라고 알린다", async () => {
  server.use(
    http.post(`${API}/rooms`, async () => {
      await delay("infinite");
      return HttpResponse.json(room());
    }),
  );
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
    fill("금요일 저녁", "2026-10-10");
    fireEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
    await screen.findByRole("button", { name: "만드는 중" });
    expect(screen.queryByText(/서버를 깨우는 중/)).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.getByText("서버를 깨우는 중이에요. 최대 1분쯤 걸려요.")).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test("방이 만들어지면 고른 지역과 테마, 약속까지 남은 날수를 통계로 남긴다", async () => {
  server.use(http.post(`${API}/rooms`, () => HttpResponse.json(room({ meet_date: "2026-10-10" }), { status: 201 })));
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  fill("금요일 저녁", "2026-10-10", ["경기", "서울"]);
  await userEvent.click(screen.getByRole("button", { name: /카페/ }));
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  await waitFor(() => expect(track).toHaveBeenCalledOnce());
  expect(track).toHaveBeenCalledWith("room_created", {
    regions: "서울,경기",
    region_count: 2,
    theme: "cafe",
    days_until_meet: 8,
  });
});

test("테마를 고르지 않으면 none으로 남기고, 방 만들기가 실패하면 남기지 않는다", async () => {
  server.use(http.post(`${API}/rooms`, () => HttpResponse.json(room(), { status: 201 })));
  const { unmount } = renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  fill("금요일 저녁", "2026-10-10", ["인천"]);
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  await waitFor(() => expect(track).toHaveBeenCalledOnce());
  expect(track).toHaveBeenCalledWith(
    "room_created",
    expect.objectContaining({ regions: "인천", region_count: 1, theme: "none" }),
  );
  unmount();

  vi.mocked(track).mockClear();
  server.use(http.post(`${API}/rooms`, () => HttpResponse.json({ detail: "문제가 생겼어요" }, { status: 500 })));
  renderWithClient(<CreateRoomForm today={TODAY} onCreated={vi.fn()} />);
  fill("금요일 저녁", "2026-10-10");
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("문제가 생겼어요");
  expect(track).not.toHaveBeenCalled();
});
