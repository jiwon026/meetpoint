"use client";

import { useEffect, useRef, useState } from "react";
import { DateStepper } from "@/components/ui/DateStepper";
import { useChangeMeetDate } from "@/lib/api/hooks";
import type { RoomOut } from "@/lib/api/types";
import { MAX_MEET_DAYS_AHEAD } from "@/lib/constants";
import { addDaysIso, dday, formatMeetDate, todayIso } from "@/lib/format";

// 예전 첫 화면이 날짜로 지어 준 이름. 이 모양이면 날짜를 바꿀 때 이름도 같이 바꾼다.
export function dateTitle(iso: string): string {
  return `${formatMeetDate(iso)} 모임`;
}

// 하루씩 여러 번 눌러도 마지막 날짜만 한 번 저장하도록 잠깐 기다린다.
const SAVE_DELAY_MS = 600;

type Props = { room: RoomOut; slug: string; now?: Date };

// 행사 탭 위의 약속 날짜. 날짜가 쓰이는 곳은 행사뿐이라 여기서만 고른다(2026-11-09).
// 링크를 가진 누구나 바꿀 수 있다 (참가자 빼기와 같은 기준). 방을 지우는 날도 따라 옮겨진다.
export function MeetDatePicker({ room, slug, now = new Date() }: Props) {
  // 누르는 동안 보이는 날짜. 저장이 끝나 방 정보가 새로 오면 비운다.
  const [draft, setDraft] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const change = useChangeMeetDate(slug);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const today = todayIso(now);
  const value = draft ?? room.meet_date;

  const save = (next: string) => {
    // 이름이 예전 날짜로 지어져 있으면 새 날짜로 다시 짓는다. 사람이 붙인 이름은 그대로 둔다.
    const rename = room.title === dateTitle(room.meet_date) ? { title: dateTitle(next) } : {};
    const settle = () => setDraft((current) => (current === next ? null : current));
    change.mutate(
      { meet_date: next, ...rename },
      {
        onSuccess: settle,
        onError: (error) => {
          setProblem(error.message);
          settle();
        },
      },
    );
  };

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current?.();
    pending.current = null;
  };

  const onChange = (next: string) => {
    setProblem(null);
    if (timer.current) clearTimeout(timer.current);
    // 원래 날짜로 돌아오면 저장할 것이 없다.
    if (next === room.meet_date) {
      setDraft(null);
      pending.current = null;
      return;
    }
    setDraft(next);
    pending.current = () => save(next);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  // 저장하기 전에 화면을 떠나면 그 자리에서 저장한다.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current(), []);

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">약속 날짜</p>
      <DateStepper value={value} min={today} max={addDaysIso(today, MAX_MEET_DAYS_AHEAD)} onChange={onChange} />
      <p className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-ink-mute">
          <span className="rounded bg-primary-tint px-1.5 py-0.5 font-bold text-primary">{dday(value, now)}</span>
          이날 열리는 행사를 보여줘요
        </span>
        <span aria-live="polite" className="text-ink-mute">
          {draft !== null || change.isPending ? "저장하는 중" : ""}
        </span>
      </p>
      {problem !== null && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {problem}
        </p>
      )}
    </div>
  );
}
