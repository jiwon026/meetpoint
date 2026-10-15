"use client";

import { useEffect, useSyncExternalStore } from "react";
import { hasSeenAnyTour, type TourName } from "@/lib/tour";
import type { TourStep } from "./Tour";
import { useTourController } from "./TourProvider";

const noSubscribe = () => () => {};

// 처음 온 브라우저에서 시작 화면이 열리면 온보딩을 연다. 서버 렌더와 첫 클라이언트 렌더에서는 본 것으로 친다.
// returnTo는 온보딩이 끝나면 돌아올 주소다.
export function useTour(name: TourName, steps: readonly TourStep[], returnTo: string) {
  const { start } = useTourController();
  const seen = useSyncExternalStore(noSubscribe, hasSeenAnyTour, () => true);

  useEffect(() => {
    if (!seen) start(name, steps, returnTo);
    // 처음 열릴 때 한 번만 본다. 단계나 주소가 바뀌어도 다시 열지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  return { replay: () => start(name, steps, returnTo) };
}
