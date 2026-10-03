"use client";

import { useState } from "react";
import { LineBadge } from "@/components/ui/LineBadge";
import { INPUT } from "@/components/ui/styles";
import { usePlaceSearch, useStationSearch } from "@/lib/api/hooks";
import { MSG_NO_SEARCH_RESULT } from "@/lib/messages";
import { useDebounced } from "@/lib/useDebounced";

export type Origin =
  | { kind: "station"; stationId: number; label: string }
  | { kind: "address"; address: string; label: string };
export type OriginMode = "station" | "address";

type Props = {
  mode: OriginMode;
  onModeChange: (mode: OriginMode) => void;
  value: Origin | null;
  onChange: (origin: Origin | null) => void;
};

const MODES: readonly { id: OriginMode; label: string; placeholder: string }[] = [
  { id: "station", label: "지하철역 선택", placeholder: "역 이름 (강남)" },
  { id: "address", label: "주소, 건물명 검색", placeholder: "주소나 건물 이름 (테헤란로 152)" },
];
const RESULT_BUTTON = "flex w-full items-center gap-2 rounded-lg border border-line bg-card p-3 text-left";

export function OriginSearch({ mode, onModeChange, value, onChange }: Props) {
  const [text, setText] = useState("");
  const term = useDebounced(text);
  const stations = useStationSearch(mode === "station" ? term : "");
  const places = usePlaceSearch(mode === "address" ? term : "");

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-primary-tint p-3">
        <span className="font-semibold text-primary">출발지: {value.label}</span>
        <button type="button" onClick={() => onChange(null)} className="shrink-0 text-sm font-semibold text-primary underline">
          다시 고르기
        </button>
      </div>
    );
  }

  const settled = term.trim() === text.trim();
  const stationItems = stations.data ?? [];
  const placeItems = places.data?.items ?? [];
  const searched = mode === "station" ? stations.isSuccess : places.isSuccess;
  // 검색 요청 자체가 실패한 경우 (연결 불량, 서버 오류). 지금 모드의 오류만 본다.
  const requestError = mode === "station" ? stations.error : places.error;
  const empty = settled && searched && (mode === "station" ? stationItems : placeItems).length === 0;

  return (
    <div className="space-y-2">
      <div role="tablist" aria-label="출발지 입력 방식" className="grid grid-cols-2 gap-1 rounded-lg bg-track p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => onModeChange(m.id)}
            className={`rounded-md py-2 text-sm font-semibold ${mode === m.id ? "bg-card text-primary" : "text-ink-sub"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <input
        aria-label="출발지 검색"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={MODES.find((m) => m.id === mode)?.placeholder}
        className={INPUT}
      />
      {mode === "address" && places.data?.error && <p className="text-sm text-accent">{places.data.error}</p>}
      {requestError && <p className="text-sm text-accent">{requestError.message}</p>}
      {empty && !(mode === "address" && places.data?.error) && (
        <p className="text-sm text-ink-mute">{MSG_NO_SEARCH_RESULT}</p>
      )}
      <ul className="space-y-1.5">
        {mode === "station" &&
          stationItems.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onChange({ kind: "station", stationId: s.id, label: `${s.name} (${s.line})` })}
                className={RESULT_BUTTON}
              >
                <span className="font-semibold">{s.name}</span>
                <LineBadge line={s.line} />
                <span className="text-sm text-ink-mute">{s.line}</span>
              </button>
            </li>
          ))}
        {mode === "address" &&
          placeItems.map((p) => (
            <li key={`${p.name}:${p.address}`}>
              <button
                type="button"
                onClick={() => onChange({ kind: "address", address: p.address, label: p.name })}
                className={RESULT_BUTTON}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block truncate text-sm text-ink-mute">{p.address}</span>
                </span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
