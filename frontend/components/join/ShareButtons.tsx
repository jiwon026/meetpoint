"use client";

import { Link2, Share2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { SECONDARY_BUTTON } from "@/components/ui/styles";
import { track } from "@/lib/analytics";
import { roomUrl, shareLink } from "@/lib/share";
import { useCopyInviteLink } from "./useCopyInviteLink";

const noSubscribe = () => () => {};

export function ShareButtons({ slug, title, place }: { slug: string; title: string; place: "join" | "result" }) {
  const copy = useCopyInviteLink(slug, place);
  // 서버 렌더와 첫 클라이언트 렌더가 같도록 공유 기능 유무는 마운트 뒤에만 읽는다.
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  const share = async () => {
    // 사용자가 공유창을 닫으면 따로 할 일이 없다. 보낸 경우만 통계를 남긴다.
    if ((await shareLink({ title, url: roomUrl(slug) })) === "shared") track("link_shared", { place });
  };

  return (
    <div className={`grid gap-2 ${canShare ? "grid-cols-2" : "grid-cols-1"}`}>
      <button type="button" onClick={copy} className={SECONDARY_BUTTON}>
        <Link2 size={16} aria-hidden />
        초대 링크 복사
      </button>
      {canShare && (
        <button type="button" onClick={share} className={SECONDARY_BUTTON}>
          <Share2 size={16} aria-hidden />
          공유하기
        </button>
      )}
    </div>
  );
}
