import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setTrackingPaused, track } from "@/lib/analytics";
import type { TourStep } from "./Tour";
import { TourProvider, useTourController } from "./TourProvider";

// 화면 주소와 이동을 흉내 낸다. push하면 주소가 바뀌고 다시 그린다.
const nav = vi.hoisted(() => ({ pathname: "/", push: vi.fn(), listeners: new Set<() => void>() }));
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useRouter: () => ({ push: nav.push }),
    usePathname: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          nav.listeners.add(listener);
          return () => nav.listeners.delete(listener);
        },
        () => nav.pathname,
      ),
  };
});

function goTo(href: string) {
  nav.pathname = href.split("?")[0];
  nav.listeners.forEach((listener) => listener());
}

beforeEach(() => {
  nav.pathname = "/";
  nav.push.mockReset();
  nav.push.mockImplementation((href: string) => act(() => goTo(href)));
});

const STEPS: TourStep[] = [
  { path: "/", target: "here", title: "여기", body: "첫 화면" },
  { path: "/r/demo/result", title: "예시", body: "다음 화면", demo: true },
];

function Starter({ steps = STEPS, returnTo = "/" }: { steps?: TourStep[]; returnTo?: string }) {
  const { start } = useTourController();
  return (
    <button type="button" onClick={() => start("home", steps, returnTo)}>
      시작
    </button>
  );
}

function show(props: Parameters<typeof Starter>[0] = {}) {
  render(
    <TourProvider>
      <div data-tour="here">밝힐 곳</div>
      <Starter {...props} />
    </TourProvider>,
  );
}

test("단계마다 그 화면으로 옮겨 가 보여주고, 끝나면 시작한 화면으로 돌아온다", async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole("button", { name: "시작" }));
  expect(setTrackingPaused).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole("dialog", { name: "1. 여기" })).toBeInTheDocument();
  expect(track).toHaveBeenLastCalledWith("tour_step", { screen: "home", step: 1 });

  await user.click(screen.getByRole("button", { name: "다음" }));
  expect(nav.push).toHaveBeenLastCalledWith("/r/demo/result");
  expect(screen.getByRole("dialog", { name: "2. 예시" })).toBeInTheDocument();
  expect(track).toHaveBeenLastCalledWith("tour_step", { screen: "home", step: 2 });

  await user.click(screen.getByRole("button", { name: "시작하기" }));
  expect(nav.push).toHaveBeenLastCalledWith("/");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(setTrackingPaused).toHaveBeenLastCalledWith(false);
  expect(track).toHaveBeenLastCalledWith("tour_closed", { screen: "home", step: 2, completed: true });
});

test("다른 화면에서 건너뛰면 시작한 화면(쿼리 포함)으로 돌아온다", async () => {
  const user = userEvent.setup();
  const steps: TourStep[] = [
    { path: "/r/demo/result", title: "예시", body: "다음 화면" },
    { path: "/r/abc123?add=1", title: "끝", body: "돌아옴" },
  ];
  nav.pathname = "/r/abc123";
  show({ steps, returnTo: "/r/abc123?add=1" });
  await user.click(screen.getByRole("button", { name: "시작" }));
  expect(nav.push).toHaveBeenLastCalledWith("/r/demo/result");
  await user.click(screen.getByRole("button", { name: "건너뛰기" }));
  expect(nav.push).toHaveBeenLastCalledWith("/r/abc123?add=1");
  expect(track).toHaveBeenLastCalledWith("tour_closed", { screen: "home", step: 1, completed: false });
});

test("이미 열려 있으면 다시 열지 않는다", async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole("button", { name: "시작" }));
  await user.click(screen.getByRole("button", { name: "다음" }));
  await user.click(screen.getByRole("button", { name: "시작" }));
  expect(screen.getByRole("dialog", { name: "2. 예시" })).toBeInTheDocument();
});
