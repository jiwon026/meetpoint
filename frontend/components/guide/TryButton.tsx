"use client";

import Link from "next/link";
import { PRIMARY_BUTTON } from "@/components/ui/styles";
import { track, type AnalyticsEvents } from "@/lib/analytics";

type Props = AnalyticsEvents["guide_cta_clicked"];

// 가이드 글에서 서비스로 넘어가는 버튼. 글이 실제로 사람을 데려오는지 재려고 누른 자리를 남긴다.
export function TryButton({ page, place }: Props) {
  return (
    <Link href="/" onClick={() => track("guide_cta_clicked", { page, place })} className={`${PRIMARY_BUTTON} my-6`}>
      지금 해 보기
    </Link>
  );
}
