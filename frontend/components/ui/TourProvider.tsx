"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setTrackingPaused, track } from "@/lib/analytics";
import { Tour, type TourStep } from "./Tour";

export type TourName = "home" | "join";

type Running = { name: TourName; steps: readonly TourStep[]; index: number; returnTo: string };

type TourApi = {
  // 온보딩을 연다. 이미 열려 있으면 무시한다. 끝나면 returnTo(시작한 화면)로 돌아온다.
  start: (name: TourName, steps: readonly TourStep[], returnTo: string) => void;
};

const TourContext = createContext<TourApi>({ start: () => {} });

export function useTourController(): TourApi {
  return useContext(TourContext);
}

function pathOnly(href: string): string {
  return href.split("?")[0];
}

// 온보딩을 화면 사이를 오가며 보여준다. 단계마다 그 단계의 화면으로 옮겨 가서 밝히고,
// 끝나거나 건너뛰면 시작한 화면으로 돌아온다. 화면이 바뀌어도 상태가 남도록 레이아웃에 둔다.
export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [running, setRunning] = useState<Running | null>(null);

  const start = useCallback<TourApi["start"]>((name, steps, returnTo) => {
    if (steps.length === 0) return;
    setRunning((current) => current ?? { name, steps, index: 0, returnTo });
    setTrackingPaused(true);
  }, []);

  const step = running ? running.steps[running.index] : null;
  const here = step !== null && pathOnly(step.path) === pathname;

  // 단계가 바뀔 때마다 남긴다. 온보딩 중에는 다른 통계를 멈추지만 이 이벤트는 보낸다.
  const runningName = running?.name;
  const runningIndex = running?.index;
  useEffect(() => {
    if (runningName !== undefined && runningIndex !== undefined) {
      track("tour_step", { screen: runningName, step: runningIndex + 1 });
    }
  }, [runningName, runningIndex]);

  // 이 단계의 화면이 아니면 그리로 옮긴다.
  useEffect(() => {
    if (step && !here) router.push(step.path);
  }, [step, here, router]);

  const finish = useCallback(
    (completed: boolean) => {
      if (!running) return;
      setRunning(null);
      setTrackingPaused(false);
      track("tour_closed", { screen: running.name, step: running.index + 1, completed });
      if (pathOnly(running.returnTo) !== pathname) router.push(running.returnTo);
    },
    [running, pathname, router],
  );

  const next = useCallback(() => {
    if (!running) return;
    if (running.index === running.steps.length - 1) {
      finish(true);
      return;
    }
    setRunning({ ...running, index: running.index + 1 });
  }, [running, finish]);

  const skip = useCallback(() => finish(false), [finish]);
  const api = useMemo(() => ({ start }), [start]);

  return (
    <TourContext.Provider value={api}>
      {children}
      {running && step && here && (
        <Tour step={step} index={running.index} total={running.steps.length} onNext={next} onSkip={skip} />
      )}
    </TourContext.Provider>
  );
}
