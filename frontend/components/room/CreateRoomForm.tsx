"use client";

import { useState, type FormEvent } from "react";
import { TicketCard } from "@/components/ui/TicketCard";
import { INPUT, PRIMARY_BUTTON } from "@/components/ui/styles";
import { useCreateRoom } from "@/lib/api/hooks";
import type { RoomOut } from "@/lib/api/types";
import { MSG_DATE_REQUIRED, MSG_PRIVACY, MSG_REGION_REQUIRED, MSG_TITLE_REQUIRED } from "@/lib/messages";
import type { Region } from "@/lib/regions";
import type { ThemeId } from "@/lib/themes";
import { RegionChips } from "./RegionChips";
import { ThemePicker } from "./ThemePicker";

type Props = { today: string; onCreated: (room: RoomOut) => void };

export function CreateRoomForm({ today, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [meetDate, setMeetDate] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [theme, setTheme] = useState<ThemeId | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const create = useCreateRoom();
  // 성공 뒤 다른 화면으로 넘어갈 때까지도 다시 누를 수 없게 막는다.
  const busy = create.isPending || create.isSuccess;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name) {
      setProblem(MSG_TITLE_REQUIRED);
      return;
    }
    if (!meetDate || meetDate < today) {
      setProblem(MSG_DATE_REQUIRED);
      return;
    }
    if (regions.length === 0) {
      setProblem(MSG_REGION_REQUIRED);
      return;
    }
    setProblem(null);
    create.mutate(
      { title: name, meet_date: meetDate, regions, theme },
      { onSuccess: onCreated, onError: (error) => setProblem(error.message) },
    );
  };

  return (
    <TicketCard label="모임 방 만들기">
      <form onSubmit={submit} noValidate className="space-y-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">모임 이름</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={40}
            placeholder="금요일 저녁 모임"
            className={INPUT}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">약속 날짜</span>
          <input
            type="date"
            value={meetDate}
            min={today}
            onChange={(event) => setMeetDate(event.target.value)}
            className={INPUT}
          />
        </label>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">어디서 만날까요 (여러 곳 가능)</legend>
          <RegionChips value={regions} onChange={setRegions} />
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">어떤 모임인가요 (선택)</legend>
          <ThemePicker value={theme} onChange={setTheme} />
        </fieldset>
        <p className="rounded-lg bg-track p-3 text-xs text-ink-sub">{MSG_PRIVACY}</p>
        {problem !== null && (
          <p role="alert" className="text-sm font-semibold text-accent">
            {problem}
          </p>
        )}
        <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
          {busy ? "만드는 중" : "방 만들고 링크 받기"}
        </button>
      </form>
    </TicketCard>
  );
}
