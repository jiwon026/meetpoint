"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { HomeScreen } from "@/components/home/HomeScreen";
import { todayIso } from "@/lib/format";

const noSubscribe = () => () => {};

export default function HomePage() {
  const router = useRouter();
  // 서버 렌더와 첫 클라이언트 렌더가 같도록 오늘 날짜는 브라우저에서만 읽는다 (미리 렌더된 HTML에 빌드 날짜가 박히지 않게).
  const today = useSyncExternalStore(noSubscribe, todayIso, () => "");

  const onStarted = (slug: string, complete: boolean) => {
    // 추천에서 뒤로 가면 빈 첫 화면이 아니라 이 방의 사람 추가 화면으로 가게, 첫 화면의 기록을 그 화면으로 바꾼다.
    // next=result가 붙으면 사람 추가 화면이 곧바로 추천으로 넘긴다 (app/r/[slug]/page.tsx).
    router.replace(complete ? `/r/${slug}?add=1&next=result` : `/r/${slug}?add=1&from=home`);
  };

  return (
    <main>
      <HomeScreen today={today} onStarted={onStarted} />
    </main>
  );
}
