"use client";

import { useEffect, useRef, useState } from "react";
import { joinTour } from "@/components/ui/tourSteps";
import { useTour } from "@/components/ui/useTour";
import { StickyAction } from "@/components/ui/StickyAction";
import { CARD, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { track } from "@/lib/analytics";
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
  // 사용법 보기를 누르면 전체 사용법을 보여주고 이 방의 참여 화면으로 돌아온다.
  // add=1을 붙여 둬야 돌아왔을 때 "이미 등록한 브라우저는 추천으로" 규칙에 걸리지 않는다.
  const joinPath = `/r/${slug}?add=1`;
  const tour = useTour("join", joinTour(joinPath), joinPath);
  const copyInviteLink = useCopyInviteLink(slug, "join");
  const presentCount = room.participants.filter((p) => p.active).length;
  // 화면이 처음 열릴 때 한 번만 통계를 남긴다. 폴링으로 방이 새로 와도 반복하지 않는다.
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track("join_viewed", { participant_count: presentCount });
  }, [presentCount]);
  // 정원은 빠진 사람을 포함한 전체 인원으로 센다 (백엔드와 같은 기준).
  const full = room.participants.length >= MAX_PARTICIPANTS;

  const onSetActive = (participant: ParticipantOut, active: boolean) => {
    if (!active && !window.confirm(msgConfirmRemove(participant.nickname))) return;
    setProblem(null);
    setActive.mutate({ id: participant.id, active }, { onError: (error) => setProblem(error.message) });
  };

  return (
    <div className="space-y-4">
      <RoomSummary room={room} slug={slug} />
      <div data-tour="invite">
        <ShareButtons slug={slug} title={room.title} place="join" />
      </div>
      {full ? (
        <p className={`${CARD} text-center font-semibold`}>{MSG_ROOM_FULL}</p>
      ) : (
        <div data-tour="join-form">
          <JoinForm
            slug={slug}
            onJoined={(participant, method) => {
              setMine(addMine(slug, participant.id));
              // 방의 목록은 아직 새로 오기 전이라 지금 인원에 한 명을 더한다.
              track("participant_added", { method, participant_count: presentCount + 1 });
            }}
          />
        </div>
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
      <button type="button" onClick={tour.open} className="mx-auto block text-sm text-ink-sub underline">
        사용법 보기
      </button>
      <StickyAction>
        <div data-tour="show-result">
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
        </div>
      </StickyAction>
    </div>
  );
}
