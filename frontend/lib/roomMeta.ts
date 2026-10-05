import type { Metadata } from "next";
import { API_BASE } from "@/lib/api/client";
import type { RoomOut } from "@/lib/api/types";
import { SERVICE_NAME } from "@/lib/constants";
import { formatMeetDate } from "@/lib/format";

// 무료 서버는 잠들었다 깨는 데 1분쯤 걸린다. 제목 때문에 페이지가 그만큼 늦게 뜨면 안 된다.
export const META_TIMEOUT_MS = 3000;

// 방 링크는 아는 사람만 보는 주소다. 검색 엔진에 잡히지 않게 한다.
const NOINDEX = { index: false, follow: false } as const;

async function fetchRoom(slug: string, timeoutMs: number): Promise<RoomOut | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}/rooms/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as RoomOut;
  } catch {
    // 백엔드에 닿지 못했거나 시간이 넘었다. 화면은 떠야 하므로 제목만 기본값으로 둔다.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function roomMetadata(slug: string, timeoutMs: number = META_TIMEOUT_MS): Promise<Metadata> {
  const room = await fetchRoom(slug, timeoutMs);
  if (!room) return { title: SERVICE_NAME, robots: NOINDEX };
  return {
    title: `${room.title} | ${SERVICE_NAME}`,
    description: `${formatMeetDate(room.meet_date)} 약속. 출발지를 넣으면 모두에게 공평한 장소를 찾아줘요.`,
    robots: NOINDEX,
  };
}
