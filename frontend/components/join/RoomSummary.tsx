import { TicketCard } from "@/components/ui/TicketCard";
import type { RoomOut } from "@/lib/api/types";
import { dday, formatMeetDate } from "@/lib/format";
import { MSG_AUTO_DELETE } from "@/lib/messages";
import { themeLabel } from "@/lib/themes";

export function RoomSummary({ room, now = new Date() }: { room: RoomOut; now?: Date }) {
  const theme = themeLabel(room.theme);
  const scope = [...room.regions, ...(theme ? [theme] : [])].join(", ");
  return (
    <TicketCard label="모임 정보">
      <h1 className="text-xl font-extrabold tracking-tight">{room.title}</h1>
      <p className="mt-1 flex items-center gap-2 text-sm text-ink-sub">
        <span>{formatMeetDate(room.meet_date)}</span>
        <span className="rounded bg-primary-tint px-1.5 py-0.5 text-xs font-bold text-primary">
          {dday(room.meet_date, now)}
        </span>
      </p>
      <p className="mt-2 text-sm text-ink-sub">{scope}</p>
      <p className="mt-1 text-xs text-ink-mute">{MSG_AUTO_DELETE}</p>
    </TicketCard>
  );
}
