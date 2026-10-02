import type { Metadata } from "next";
import type { ReactNode } from "react";
import { API_BASE } from "@/lib/api/client";
import type { RoomOut } from "@/lib/api/types";
import { SERVICE_NAME } from "@/lib/constants";
import { formatMeetDate } from "@/lib/format";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  try {
    const response = await fetch(`${API_BASE}/rooms/${slug}`, { cache: "no-store" });
    if (!response.ok) return { title: SERVICE_NAME };
    const room = (await response.json()) as RoomOut;
    return {
      title: `${room.title} | ${SERVICE_NAME}`,
      description: `${formatMeetDate(room.meet_date)} 약속. 출발지를 넣으면 모두에게 공평한 장소를 찾아줘요.`,
    };
  } catch {
    // 백엔드에 닿지 못해도 화면은 떠야 한다. 제목만 기본값으로 둔다.
    return { title: SERVICE_NAME };
  }
}

export default function RoomLayout({ children }: { children: ReactNode }) {
  return children;
}
