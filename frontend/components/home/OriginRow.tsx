"use client";

import { OriginLabel, OriginSearch, type Origin, type OriginMode } from "@/components/join/OriginSearch";
import { SMALL_BUTTON } from "@/components/ui/styles";

type Props = {
  // 이름을 비워 두면 쓰는 이름 ("나", "친구 1").
  fallbackName: string;
  name: string;
  onNameChange: (name: string) => void;
  mode: OriginMode;
  onModeChange: (mode: OriginMode) => void;
  origin: Origin | null;
  onOriginChange: (origin: Origin | null) => void;
  // 검색 칸은 한 번에 한 줄만 펼친다.
  open: boolean;
  // 펼칠 때 검색 칸에 초점을 줄지.
  focusSearch: boolean;
  onOpen: () => void;
  onRemove?: () => void;
};

export function OriginRow({
  fallbackName,
  name,
  onNameChange,
  mode,
  onModeChange,
  origin,
  onOriginChange,
  open,
  focusSearch,
  onOpen,
  onRemove,
}: Props) {
  return (
    <li className="space-y-2 rounded-card border border-line bg-card p-3">
      <div className="flex items-center gap-2">
        <input
          aria-label={`${fallbackName} 이름`}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          maxLength={20}
          placeholder={fallbackName}
          className="w-20 shrink-0 rounded-lg bg-primary-tint px-2 py-2 text-center text-sm font-semibold text-primary outline-none placeholder:text-primary focus:ring-2 focus:ring-primary"
        />
        {origin ? (
          <>
            <span className="min-w-0 flex-1 leading-snug">
              <OriginLabel origin={origin} />
            </span>
            <button type="button" onClick={() => onOriginChange(null)} className={SMALL_BUTTON}>
              바꾸기
            </button>
          </>
        ) : open ? (
          <span className="flex-1 text-sm text-ink-mute">어디서 출발하나요</span>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="flex-1 rounded-lg border border-line bg-card px-3 py-2.5 text-left text-ink-mute"
          >
            출발지 넣기
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            aria-label={`${fallbackName} 줄 지우기`}
            onClick={onRemove}
            className="shrink-0 px-1 text-lg text-ink-mute"
          >
            ×
          </button>
        )}
      </div>
      {open && !origin && (
        <OriginSearch
          key={mode}
          mode={mode}
          onModeChange={onModeChange}
          value={null}
          onChange={onOriginChange}
          autoFocus={focusSearch}
        />
      )}
    </li>
  );
}
