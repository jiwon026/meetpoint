"use client";

import { addDaysIso, formatMeetDate } from "@/lib/format";

type Props = { value: string; min: string; max: string; onChange: (iso: string) => void };

const STEP_BUTTON =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-lg font-bold text-ink-sub disabled:opacity-40";

// 하루씩 앞뒤로 옮기거나 가운데를 눌러 달력에서 고른다. 요일을 같이 보여준다.
// 가운데는 진짜 날짜 칸을 투명하게 덮어 둔 것이다. 휴대폰은 칸을 누르면 달력이 뜨고,
// 컴퓨터 브라우저는 칸을 눌러도 달력이 안 뜨는 경우가 있어 showPicker를 함께 부른다.
export function DateStepper({ value, min, max, onChange }: Props) {
  const inRange = (iso: string) => iso >= min && iso <= max;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="하루 전"
        disabled={!inRange(addDaysIso(value, -1))}
        onClick={() => onChange(addDaysIso(value, -1))}
        className={STEP_BUTTON}
      >
        ‹
      </button>
      <label className="relative flex-1 cursor-pointer rounded-lg bg-track px-3 py-2.5 text-center font-semibold focus-within:ring-2 focus-within:ring-primary">
        <span aria-hidden="true">{formatMeetDate(value)}</span>
        <input
          type="date"
          aria-label={`약속 날짜 ${formatMeetDate(value)}, 달력에서 고르기`}
          value={value}
          min={min}
          max={max}
          onClick={(event) => {
            try {
              event.currentTarget.showPicker();
            } catch {
              // showPicker가 없는 브라우저는 칸을 누른 기본 동작에 맡긴다.
            }
          }}
          onChange={(event) => {
            if (inRange(event.target.value)) onChange(event.target.value);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <button
        type="button"
        aria-label="하루 뒤"
        disabled={!inRange(addDaysIso(value, 1))}
        onClick={() => onChange(addDaysIso(value, 1))}
        className={STEP_BUTTON}
      >
        ›
      </button>
    </div>
  );
}
