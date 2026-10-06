"use client";

import { useState, type FormEvent } from "react";
import { CARD, INPUT, PRIMARY_BUTTON } from "@/components/ui/styles";
import { useAddParticipant } from "@/lib/api/hooks";
import type { ParticipantOut } from "@/lib/api/types";
import { MSG_NICKNAME_REQUIRED, MSG_ORIGIN_REQUIRED } from "@/lib/messages";
import { OriginSearch, type Origin, type OriginMode } from "./OriginSearch";

type Props = { slug: string; onJoined: (participant: ParticipantOut, method: OriginMode) => void };

export function JoinForm({ slug, onJoined }: Props) {
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState<OriginMode>("station");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // 등록에 성공할 때마다 올려서 검색창을 새로 만든다 (입력한 검색어를 비우기 위해).
  const [round, setRound] = useState(0);
  const add = useAddParticipant(slug);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = nickname.trim();
    if (!name) {
      setProblem(MSG_NICKNAME_REQUIRED);
      return;
    }
    if (!origin) {
      setProblem(MSG_ORIGIN_REQUIRED);
      return;
    }
    setProblem(null);
    const body =
      origin.kind === "station"
        ? { nickname: name, station_id: origin.stationId }
        : { nickname: name, address: origin.address };
    add.mutate(body, {
      onSuccess: (participant) => {
        setNickname("");
        setOrigin(null);
        setRound((n) => n + 1);
        onJoined(participant, origin.kind);
      },
      onError: (error) => {
        setProblem(error.message);
        // 주소를 좌표로 못 바꾼 경우에는 역 선택으로 안내한다.
        if (origin.kind === "address" && (error.status === 422 || error.status === 503)) {
          setOrigin(null);
          setMode("station");
        }
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className={`${CARD} space-y-4`}>
      <h2 className="font-bold">출발지 등록</h2>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">닉네임</span>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={20}
          placeholder="친구들이 알아볼 이름"
          className={INPUT}
        />
      </label>
      <OriginSearch
        key={`${round}:${mode}`}
        mode={mode}
        onModeChange={(next) => {
          setOrigin(null);
          setMode(next);
        }}
        value={origin}
        onChange={setOrigin}
      />
      {problem !== null && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {problem}
        </p>
      )}
      <button type="submit" disabled={add.isPending} className={PRIMARY_BUTTON}>
        {add.isPending ? "등록하는 중" : "출발지 등록"}
      </button>
    </form>
  );
}
