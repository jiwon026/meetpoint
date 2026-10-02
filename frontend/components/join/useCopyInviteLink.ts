"use client";

import { useToast } from "@/components/ui/Toast";
import { MSG_LINK_COPIED, MSG_LINK_COPY_FAILED } from "@/lib/messages";
import { copyText, roomUrl } from "@/lib/share";

// 초대 링크를 복사하고 결과를 토스트로 알리는 함수를 돌려준다.
export function useCopyInviteLink(slug: string): () => Promise<void> {
  const toast = useToast();
  return async () => {
    toast((await copyText(roomUrl(slug))) ? MSG_LINK_COPIED : MSG_LINK_COPY_FAILED);
  };
}
