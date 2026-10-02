import { CARD, SMALL_BUTTON } from "@/components/ui/styles";
import type { ParticipantOut } from "@/lib/api/types";
import { MSG_BUS, MSG_EMPTY_ROSTER } from "@/lib/messages";

type Props = {
  participants: readonly ParticipantOut[];
  mine: readonly number[];
  busyId: number | null;
  onSetActive: (participant: ParticipantOut, active: boolean) => void;
};

type RowProps = { participant: ParticipantOut; isMine: boolean; busy: boolean; onSetActive: Props["onSetActive"] };

function Row({ participant, isMine, busy, onSetActive }: RowProps) {
  const action = participant.active ? "빼기" : "다시 넣기";
  const origin = `${participant.nearest_station_name} 출발${participant.via === "bus" ? `, ${MSG_BUS}` : ""}`;
  return (
    <li className={`flex items-center justify-between gap-2 ${participant.active ? "" : "opacity-60"}`}>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-semibold">
          <span className="truncate">{participant.nickname}</span>
          {isMine && (
            <span className="shrink-0 rounded bg-primary-tint px-1.5 py-0.5 text-[11px] font-bold text-primary">
              내가 등록
            </span>
          )}
        </p>
        <p className="truncate text-sm text-ink-sub">{origin}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        aria-label={`${participant.nickname} ${action}`}
        onClick={() => onSetActive(participant, !participant.active)}
        className={SMALL_BUTTON}
      >
        {action}
      </button>
    </li>
  );
}

export function Roster({ participants, mine, busyId, onSetActive }: Props) {
  const present = participants.filter((p) => p.active);
  const away = participants.filter((p) => !p.active);
  const heading = away.length > 0 ? `참여 ${present.length}명, 빠진 사람 ${away.length}명` : `참여 ${present.length}명`;
  const row = (p: ParticipantOut) => (
    <Row key={p.id} participant={p} isMine={mine.includes(p.id)} busy={busyId === p.id} onSetActive={onSetActive} />
  );
  return (
    <section className={`${CARD} space-y-3`}>
      <h2 className="font-bold">{heading}</h2>
      {present.length === 0 && <p className="text-sm text-ink-mute">{MSG_EMPTY_ROSTER}</p>}
      <ul className="space-y-3">{present.map(row)}</ul>
      {away.length > 0 && (
        <div className="space-y-3 border-t border-line pt-3">
          <h3 className="text-sm font-semibold text-ink-mute">빠진 사람</h3>
          <ul className="space-y-3">{away.map(row)}</ul>
        </div>
      )}
    </section>
  );
}
