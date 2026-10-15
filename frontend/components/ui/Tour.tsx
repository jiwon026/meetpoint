"use client";

import { useEffect, useRef, useState } from "react";

// path는 이 단계를 보여줄 화면의 주소(쿼리 포함), target은 밝힐 요소의 data-tour 값이다.
// target이 없으면 밝히지 않고 가운데에 띄운다. demo는 예시 방 화면을 보여주는 단계다.
export type TourStep = { path: string; target?: string; title: string; body: string; demo?: boolean };

type Rect = { top: number; left: number; width: number; height: number };

type Props = {
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
};

const PAD = 6;
const TIP_SPACE = 190;

function measure(target: string | undefined): Rect | null {
  if (!target) return null;
  const node = document.querySelector(`[data-tour="${target}"]`);
  if (!node) return null;
  const box = node.getBoundingClientRect();
  return { top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 };
}

// 화면의 한 곳을 밝혀 설명한다. 나머지는 어둡게 덮고 눌리지 않게 막는다. 단계 넘기기는 TourProvider가 맡는다.
export function Tour({ step, index, total, onNext, onSkip }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const last = index === total - 1;

  useEffect(() => {
    const node = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
    // 테스트 환경(jsdom)에는 scrollIntoView가 없다.
    node?.scrollIntoView?.({ block: "center" });
    let frame = requestAnimationFrame(() => setRect(measure(step.target)));
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRect(measure(step.target)));
    };
    // 다른 화면으로 넘어온 직후처럼 늦게 그려지는 곳도 잡히게 잠깐마다 다시 잰다.
    // 늦게 잡힌 곳은 처음 잡혔을 때 한 번 가운데로 굴린다.
    let scrolled = node !== null;
    const poll = setInterval(() => {
      if (!scrolled && step.target) {
        const late = document.querySelector(`[data-tour="${step.target}"]`);
        late?.scrollIntoView?.({ block: "center" });
        scrolled = late !== null;
      }
      update();
    }, 400);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(poll);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step.target, step.path]);

  useEffect(() => {
    nextButton.current?.focus();
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  // 밝힌 곳 아래에 자리가 있으면 아래, 위에 있으면 위, 둘 다 없으면(밝힌 곳이 크면) 화면 아래에 붙인다.
  // 밝힐 곳이 없거나 못 찾으면 가운데.
  const tipPlace =
    rect === null
      ? { top: "50%", transform: "translateY(-50%)" }
      : rect.top + rect.height + TIP_SPACE < window.innerHeight
        ? { top: rect.top + rect.height + 12 }
        : rect.top > TIP_SPACE
          ? { bottom: window.innerHeight - rect.top + 12 }
          : { bottom: 16 };

  return (
    <div className="fixed inset-0 z-50">
      {/* 밝힌 곳 바깥을 눌러도 아래 화면이 눌리지 않게 덮는다 */}
      <div className="absolute inset-0" aria-hidden />
      {rect ? (
        <div
          data-testid="tour-spot"
          className="pointer-events-none absolute rounded-card shadow-[0_0_0_9999px_var(--color-scrim)] ring-2 ring-card"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ) : (
        <div className="absolute inset-0 bg-scrim" />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="absolute inset-x-4 mx-auto max-w-[448px] rounded-card bg-card p-4 text-ink"
        style={tipPlace}
      >
        {step.demo && (
          <span className="mb-1 inline-block rounded bg-primary-tint px-1.5 py-0.5 text-xs font-bold text-primary">
            예시 화면
          </span>
        )}
        <h2 id="tour-title" className="font-bold">
          {index + 1}. {step.title}
        </h2>
        <p className="mt-1 text-sm text-ink-sub">{step.body}</p>
        <div className="mt-3 flex items-center justify-between">
          {last ? (
            <span />
          ) : (
            <button type="button" onClick={onSkip} className="text-sm font-semibold text-ink-mute">
              건너뛰기
            </button>
          )}
          <span className="flex gap-1.5" aria-label={`${total}단계 중 ${index + 1}단계`}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-primary" : "bg-line"}`} />
            ))}
          </span>
          <button
            ref={nextButton}
            type="button"
            onClick={onNext}
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-white"
          >
            {last ? "시작하기" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
