"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setTrackingPaused, track } from "@/lib/analytics";
import { markTourSeen, type TourName } from "@/lib/tour";
import { Tour, type TourStep } from "./Tour";

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

  // 이 단계의 화면이 아니면 그리로 옮긴다.
  useEffect(() => {
    if (step && !here) router.push(step.path);
  }, [step, here, router]);

  const finish = useCallback(
    (completed: boolean) => {
      if (!running) return;
      markTourSeen(running.name);
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
