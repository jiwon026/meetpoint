export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 권한이 없거나 http 환경. 호출한 쪽이 "직접 복사" 안내를 띄운다.
    return false;
  }
}

export type ShareOutcome = "shared" | "cancelled" | "unsupported";

// 휴대폰의 공유창(카카오톡, 메시지 등)으로 보낸다. 공유창이 없는 브라우저면 unsupported를 돌려
// 호출한 쪽이 링크 복사로 대신하게 한다. 사용자가 창을 닫으면 cancelled.
export async function shareLink(data: { title: string; url: string }): Promise<ShareOutcome> {
  if (typeof navigator.share !== "function") return "unsupported";
  try {
    await navigator.share(data);
    return "shared";
  } catch {
    return "cancelled";
  }
}

export function roomUrl(slug: string, origin: string = window.location.origin): string {
  return `${origin}/r/${slug}`;
}
