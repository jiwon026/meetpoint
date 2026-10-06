"use client";

import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics";
import { MSG_LINK_COPIED, MSG_LINK_COPY_FAILED } from "@/lib/messages";
import { copyText, roomUrl } from "@/lib/share";

// 초대 링크를 복사하고 결과를 토스트로 알리는 함수를 돌려준다.
// place는 통계에 남기는 값이다: 어느 화면에서 복사했는지.
export function useCopyInviteLink(slug: string, place: "join" | "result"): () => Promise<void> {
  const toast = useToast();
  return async () => {
    const copied = await copyText(roomUrl(slug));
    toast(copied ? MSG_LINK_COPIED : MSG_LINK_COPY_FAILED);
    if (copied) track("link_copied", { place });
  };
}
