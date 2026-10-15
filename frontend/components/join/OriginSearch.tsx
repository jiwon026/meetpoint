"use client";

import { useState } from "react";
import { StationName } from "@/components/ui/StationName";
import { INPUT } from "@/components/ui/styles";
import { usePlaceSearch, useStationSearch } from "@/lib/api/hooks";
import { MSG_NO_SEARCH_RESULT } from "@/lib/messages";
import { useDebounced } from "@/lib/useDebounced";

export type Origin =
  | { kind: "station"; stationId: number; label: string; lines: string[] }
  | { kind: "address"; address: string; label: string };
export type OriginMode = "station" | "address";

type Props = {
  mode: OriginMode;
  onModeChange: (mode: OriginMode) => void;
  value: Origin | null;
  onChange: (origin: Origin | null) => void;
  // 검색 칸이 그려질 때 초점을 준다 (첫 화면에서 다음 줄로 넘어갈 때).
  autoFocus?: boolean;
};

const MODES: readonly { id: OriginMode; label: string; placeholder: string }[] = [
  { id: "station", label: "지하철역 선택", placeholder: "역 이름 (강남)" },
  { id: "address", label: "주소, 건물명 검색", placeholder: "주소나 건물 이름 (테헤란로 152)" },
];
const RESULT_BUTTON = "flex w-full items-center gap-2 rounded-lg border border-line bg-card p-3 text-left";

// 고른 출발지를 보여준다. 역이면 이름과 노선 배지, 주소면 장소 이름.
export function OriginLabel({ origin }: { origin: Origin }) {
  return origin.kind === "station" ? (
    <StationName name={origin.label} lines={origin.lines} />
  ) : (
    <span className="font-semibold">{origin.label}</span>
  );
}

export function OriginSearch({ mode, onModeChange, value, onChange, autoFocus = false }: Props) {
  const [text, setText] = useState("");
  const term = useDebounced(text);
  const stations = useStationSearch(mode === "station" ? term : "");
  const places = usePlaceSearch(mode === "address" ? term : "");

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-primary-tint p-3">
        <span className="flex min-w-0 items-center gap-1.5 text-primary">
          <span className="shrink-0 font-semibold">출발지:</span>
          <OriginLabel origin={value} />
        </span>
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
        autoFocus={autoFocus}
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
          stationItems.map((s) => {
            // 환승역은 한 줄에 노선을 모두 보여준다. lines가 없는 응답(배포가 엇갈린 동안의 예전 서버)은 line으로 읽는다.
            const lines = s.lines?.length ? s.lines : [s.line];
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onChange({ kind: "station", stationId: s.id, label: s.name, lines })}
                  className={RESULT_BUTTON}
                >
                  <StationName name={s.name} lines={lines} />
                </button>
              </li>
            );
          })}
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
