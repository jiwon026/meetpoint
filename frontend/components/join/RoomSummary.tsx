import { TicketCard } from "@/components/ui/TicketCard";
import type { RoomOut } from "@/lib/api/types";
import { formatMeetDate } from "@/lib/format";
import { msgAutoDelete } from "@/lib/messages";
import { themeLabels } from "@/lib/themes";

// 약속 날짜는 여기서 보여주지도 고르게 하지도 않는다. 둘러보기의 행사 탭에서 고른다(2026-11-09).
export function RoomSummary({ room }: { room: RoomOut }) {
  const scope = [...room.regions, ...themeLabels(room.themes)].join(", ");
  return (
    <TicketCard label="모임 정보">
      <h1 className="text-xl font-extrabold tracking-tight">{room.title}</h1>
      <p className="mt-1 text-sm text-ink-sub">각자 출발지를 넣으면 모두에게 공평한 만남 장소를 추천해요.</p>
      <p className="mt-2 text-sm text-ink-sub">{scope}</p>
      <p className="mt-1 text-xs text-ink-mute">{msgAutoDelete(formatMeetDate(room.expires_at.slice(0, 10)))}</p>
    </TicketCard>
  );
}
