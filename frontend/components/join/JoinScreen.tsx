"use client";

import { useState } from "react";
import { StickyAction } from "@/components/ui/StickyAction";
import { CARD, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { useSetParticipantActive } from "@/lib/api/hooks";
import type { ParticipantOut, RoomOut } from "@/lib/api/types";
import { MAX_PARTICIPANTS } from "@/lib/constants";
import { MSG_NEED_TWO, MSG_ROOM_FULL, msgConfirmRemove } from "@/lib/messages";
import { addMine, readMine } from "@/lib/myParticipants";
import { JoinForm } from "./JoinForm";
import { RoomSummary } from "./RoomSummary";
import { Roster } from "./Roster";
import { ShareButtons } from "./ShareButtons";
import { useCopyInviteLink } from "./useCopyInviteLink";

type Props = { slug: string; room: RoomOut; onShowResult: () => void };

export function JoinScreen({ slug, room, onShowResult }: Props) {
  const [mine, setMine] = useState(() => readMine(slug));
  const [problem, setProblem] = useState<string | null>(null);
  const setActive = useSetParticipantActive(slug);
  const copyInviteLink = useCopyInviteLink(slug);
  const presentCount = room.participants.filter((p) => p.active).length;
  // 정원은 빠진 사람을 포함한 전체 인원으로 센다 (백엔드와 같은 기준).
  const full = room.participants.length >= MAX_PARTICIPANTS;

  const onSetActive = (participant: ParticipantOut, active: boolean) => {
    if (!active && !window.confirm(msgConfirmRemove(participant.nickname))) return;
    setProblem(null);
    setActive.mutate({ id: participant.id, active }, { onError: (error) => setProblem(error.message) });
  };

  return (
    <div className="space-y-4">
      <RoomSummary room={room} />
      <ShareButtons slug={slug} title={room.title} />
      {full ? (
        <p className={`${CARD} text-center font-semibold`}>{MSG_ROOM_FULL}</p>
      ) : (
        <JoinForm slug={slug} onJoined={(participant) => setMine(addMine(slug, participant.id))} />
      )}
      {problem !== null && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {problem}
        </p>
      )}
      <Roster
        participants={room.participants}
        mine={mine}
        busyId={setActive.isPending ? (setActive.variables?.id ?? null) : null}
        onSetActive={onSetActive}
      />
      <StickyAction>
        {presentCount >= 2 ? (
          <button type="button" onClick={onShowResult} className={PRIMARY_BUTTON}>
            추천 보기 ({presentCount}명)
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-center text-sm font-semibold text-ink-sub">{MSG_NEED_TWO}</p>
            <button type="button" onClick={copyInviteLink} className={SECONDARY_BUTTON}>
              초대 링크 복사
            </button>
          </div>
        )}
      </StickyAction>
    </div>
  );
}
