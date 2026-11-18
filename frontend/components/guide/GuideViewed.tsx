"use client";

import { useEffect, useRef } from "react";
import { initAnalytics, track, type AnalyticsEvents } from "@/lib/analytics";

type Props = AnalyticsEvents["guide_viewed"];

// 가이드 글을 몇 명이 읽는지 센다. 화면에는 아무것도 그리지 않는다.
// 자식 효과는 Providers의 초기화보다 먼저 돌아서, 검색으로 바로 들어온 방문이 버려지지 않게 초기화를 먼저 부른다(여러 번 불러도 한 번만 된다).
export function GuideViewed({ page }: Props) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    initAnalytics();
    track("guide_viewed", { page });
  }, [page]);
  return null;
}
