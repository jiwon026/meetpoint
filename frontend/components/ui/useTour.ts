"use client";

import type { TourStep } from "./Tour";
import { useTourController, type TourName } from "./TourProvider";

// 사용법 보기 버튼에 거는 함수를 돌려준다. 저절로 열지 않는다(2026-10-24: 처음 온 24명 중 17명이 온보딩을 닫지 않고 나갔다).
// returnTo는 온보딩이 끝나면 돌아올 주소다.
export function useTour(name: TourName, steps: readonly TourStep[], returnTo: string) {
  const { start } = useTourController();
  return { open: () => start(name, steps, returnTo) };
}
