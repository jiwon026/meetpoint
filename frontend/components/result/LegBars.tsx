import type { LegOut } from "@/lib/api/types";
import { transitDirectionsUrl, type MapPoint } from "@/lib/directions";
import { aboutMinutes } from "@/lib/format";
import { MSG_BUS } from "@/lib/messages";

const MIN_BAR_PERCENT = 8;

type Props = {
  legs: readonly LegOut[];
  mine: readonly number[];
  // 추천 거점. 주면 사람마다 그곳까지의 길찾기 링크를 단다.
  destination?: MapPoint;
  // 길찾기 링크를 눌렀을 때 부른다 (통계용).
  onDirections?: () => void;
};

export function LegBars({ legs, mine, destination, onDirections }: Props) {
  const longest = Math.max(...legs.map((leg) => leg.minutes), 1);
  return (
    <ul className="space-y-2.5">
      {legs.map((leg) => {
        const slowest = leg.minutes === longest;
        const width = Math.max(MIN_BAR_PERCENT, Math.round((leg.minutes / longest) * 100));
        const origin = `${leg.origin_station_name}${leg.via === "bus" ? `, ${MSG_BUS}` : ""}`;
        const directions =
          destination && leg.origin_lat !== null && leg.origin_lng !== null
            ? transitDirectionsUrl({ name: leg.origin_station_name, lat: leg.origin_lat, lng: leg.origin_lng }, destination)
            : null;
        return (
          <li key={leg.participant_id} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className={`truncate font-semibold ${slowest ? "text-accent" : ""}`}>{leg.nickname}</span>
                {mine.includes(leg.participant_id) && <span className="text-xs font-bold text-primary">나</span>}
                <span className="truncate text-ink-mute">{origin}</span>
                {directions && (
                  <a
                    href={directions}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${leg.nickname} 길찾기`}
                    onClick={onDirections}
                    className="shrink-0 text-xs font-semibold text-primary underline"
                  >
                    길찾기
                  </a>
                )}
              </span>
              <span className={`shrink-0 font-bold ${slowest ? "text-accent" : ""}`}>{aboutMinutes(leg.minutes)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-track">
              <div
                data-testid="leg-bar"
                style={{ width: `${width}%` }}
                className={`h-full rounded-full ${slowest ? "bg-accent" : "bg-primary-soft"}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
