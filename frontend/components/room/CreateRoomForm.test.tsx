import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";
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
  await userEvent.click(screen.getByRole("button", { name: /카페/ }));
  await userEvent.click(screen.getByRole("button", { name: "방 만들고 링크 받기" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  expect(onCreated.mock.calls[0][0].slug).toBe("k3x9pq");
  expect(body).toEqual({ title: "금요일 저녁", meet_date: "2026-10-10", regions: ["서울", "인천"], theme: "cafe" });
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
