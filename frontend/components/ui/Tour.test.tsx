import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Tour } from "./Tour";

function Page({ step, index = 0, total = 3 }: { step: Parameters<typeof Tour>[0]["step"]; index?: number; total?: number }) {
  const onNext = vi.fn();
  const onSkip = vi.fn();
  render(
    <>
      <div data-tour="a">가</div>
      <Tour step={step} index={index} total={total} onNext={onNext} onSkip={onSkip} />
    </>,
  );
  return { onNext, onSkip };
}

test("밝힐 곳을 찾으면 밝히고, 다음과 건너뛰기를 부른다", async () => {
  const user = userEvent.setup();
  const { onNext, onSkip } = Page({ step: { path: "/", target: "a", title: "첫째", body: "첫째 설명" } });
  expect(screen.getByRole("dialog", { name: "1. 첫째" })).toHaveTextContent("첫째 설명");
  expect(screen.getByRole("button", { name: "다음" })).toHaveFocus();
  expect(await screen.findByTestId("tour-spot")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "다음" }));
  await user.click(screen.getByRole("button", { name: "건너뛰기" }));
  await user.keyboard("{Escape}");
  expect(onNext).toHaveBeenCalledOnce();
  expect(onSkip).toHaveBeenCalledTimes(2);
});

test("밝힐 곳이 없으면 가운데에 띄우고, 예시 화면이면 표시를 붙이고, 마지막 단계는 시작하기만 있다", () => {
  Page({ step: { path: "/r/demo/result", title: "셋째", body: "셋째 설명", demo: true }, index: 2 });
  expect(screen.getByRole("dialog", { name: "3. 셋째" })).toHaveTextContent("예시 화면");
  expect(screen.queryByTestId("tour-spot")).toBeNull();
  expect(screen.queryByRole("button", { name: "건너뛰기" })).toBeNull();
  expect(screen.getByRole("button", { name: "시작하기" })).toBeInTheDocument();
});
