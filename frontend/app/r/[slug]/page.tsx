"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { JoinScreen } from "@/components/join/JoinScreen";
import { RoomGate } from "@/components/join/RoomGate";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { readMine } from "@/lib/myParticipants";

function JoinPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const adding = useSearchParams().get("add") === "1";

  // 이미 누군가를 등록한 브라우저는 추천으로 보낸다. "사람 추가"로 돌아온 경우(add=1)는 예외.
  useEffect(() => {
    if (!adding && readMine(slug).length > 0) router.replace(`/r/${slug}/result`);
  }, [adding, slug, router]);

  return (
    <main>
      <StepIndicator current={2} slug={slug} />
      <RoomGate slug={slug}>
        {(room) => <JoinScreen slug={slug} room={room} onShowResult={() => router.push(`/r/${slug}/result`)} />}
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
