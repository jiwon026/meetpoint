"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { CreateRoomForm } from "@/components/room/CreateRoomForm";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { useToast } from "@/components/ui/Toast";
import { CARD } from "@/components/ui/styles";
import type { RoomOut } from "@/lib/api/types";
import { todayIso } from "@/lib/format";
import { MSG_ROOM_CREATED, MSG_ROOM_CREATED_NO_COPY } from "@/lib/messages";
import { copyText, roomUrl } from "@/lib/share";

const HOW_IT_WORKS = [
  { title: "방을 만들고 링크를 공유해요", body: "모임 이름과 날짜만 적으면 초대 링크가 생겨요." },
  { title: "각자 출발지를 넣어요", body: "가입 없이 가까운 지하철역이나 주소를 고르면 끝이에요." },
  { title: "공평한 장소를 추천받아요", body: "가장 오래 걸리는 사람의 이동시간이 가장 짧은 곳부터 보여줘요." },
];

const noSubscribe = () => () => {};

export default function HomePage() {
  const router = useRouter();
  const toast = useToast();
  // 서버 렌더와 첫 클라이언트 렌더가 같도록 오늘 날짜는 브라우저에서만 읽는다 (미리 렌더된 HTML에 빌드 날짜가 박히지 않게).
  const today = useSyncExternalStore(noSubscribe, todayIso, () => "");

  const onCreated = async (room: RoomOut) => {
    const copied = await copyText(roomUrl(room.slug));
    toast(copied ? MSG_ROOM_CREATED : MSG_ROOM_CREATED_NO_COPY);
    router.push(`/r/${room.slug}`);
  };

  return (
    <main className="space-y-5">
      <StepIndicator current={1} />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">모두에게 공평한 만남 장소</h1>
        <p className="mt-1 text-sm text-ink-sub">출발지만 넣으면 놀 거리가 있는 중간 지점을 찾아줘요.</p>
      </div>
      <CreateRoomForm today={today} onCreated={onCreated} />
      <section className={`${CARD} space-y-3`}>
        <h2 className="font-bold">이렇게 써요</h2>
        <ol className="space-y-3">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-sm text-ink-sub">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
