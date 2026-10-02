"use client";

import { Link2, Share2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useToast } from "@/components/ui/Toast";
import { SECONDARY_BUTTON } from "@/components/ui/styles";
import { MSG_LINK_COPIED, MSG_LINK_COPY_FAILED } from "@/lib/messages";
import { copyText, roomUrl } from "@/lib/share";

const noSubscribe = () => () => {};

export function ShareButtons({ slug, title }: { slug: string; title: string }) {
  const toast = useToast();
  // 서버 렌더와 첫 클라이언트 렌더가 같도록 공유 기능 유무는 마운트 뒤에만 읽는다.
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  const copy = async () => {
    toast((await copyText(roomUrl(slug))) ? MSG_LINK_COPIED : MSG_LINK_COPY_FAILED);
  };
  const share = () => {
    // 사용자가 공유창을 닫으면 거절된다. 따로 할 일이 없다.
    navigator.share({ title, url: roomUrl(slug) }).catch(() => {});
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
