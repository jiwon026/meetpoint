"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { JoinScreen } from "@/components/join/JoinScreen";
import { RoomGate } from "@/components/join/RoomGate";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { readMine } from "@/lib/myParticipants";

function JoinPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const adding = search.get("add") === "1";
  // 첫 화면에서 방을 만들고 사람을 다 넣은 직후에 온 경우. 이 화면은 뒤로 가기 자리로만 남기고 곧바로 추천으로 넘긴다.
  // 처음 그려질 때의 주소로만 판단한다. 아래에서 주소를 바꾸면 useSearchParams가 따라 바뀌는데,
  // 그때 참여 화면이 잠깐 그려지면 초대받아 들어온 것처럼 통계(join_viewed)가 찍힌다.
  const [forwarding] = useState(() => search.get("next") === "result");
  const forwarded = useRef(false);

  const showResult = useCallback(() => {
    // 뒤로 가기가 곧바로 결과로 되튕기지 않게, 지금 기록을 사람 추가 화면으로 바꿔 둔다.
    window.history.replaceState(null, "", `/r/${slug}?add=1`);
    router.push(`/r/${slug}/result`);
  }, [slug, router]);

  useEffect(() => {
    if (forwarding) {
      if (forwarded.current) return;
      forwarded.current = true;
      showResult();
      return;
    }
    // 이미 누군가를 등록한 브라우저는 추천으로 보낸다. "사람 추가"로 돌아온 경우(add=1)는 예외.
    if (!adding && readMine(slug).length > 0) router.replace(`/r/${slug}/result`);
  }, [forwarding, adding, slug, router, showResult]);

  // 넘기는 동안 사람 추가 화면이 잠깐 비치지 않게 한다.
  if (forwarding) return null;

  return (
    <main>
      <ProgressBar current={1} fill={0.6} />
      <RoomGate slug={slug}>
        {(room) => <JoinScreen slug={slug} room={room} onShowResult={showResult} />}
      </RoomGate>
    </main>
  );
}

export default function Page() {
  // useSearchParams를 쓰는 클라이언트 페이지는 Suspense 경계가 있어야 빌드된다.
  return (
    <Suspense fallback={null}>
      <JoinPage />
    </Suspense>
  );
}
