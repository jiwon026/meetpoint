import type { LegOut } from "@/lib/api/types";
import { aboutMinutes } from "@/lib/format";
import { MSG_BUS } from "@/lib/messages";

const MIN_BAR_PERCENT = 8;

export function LegBars({ legs, mine }: { legs: readonly LegOut[]; mine: readonly number[] }) {
  const longest = Math.max(...legs.map((leg) => leg.minutes), 1);
  return (
    <ul className="space-y-2.5">
      {legs.map((leg) => {
        const slowest = leg.minutes === longest;
        const width = Math.max(MIN_BAR_PERCENT, Math.round((leg.minutes / longest) * 100));
        const origin = `${leg.origin_station_name}${leg.via === "bus" ? `, ${MSG_BUS}` : ""}`;
        return (
          <li key={leg.participant_id} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className={`truncate font-semibold ${slowest ? "text-accent" : ""}`}>{leg.nickname}</span>
                {mine.includes(leg.participant_id) && <span className="text-xs font-bold text-primary">나</span>}
                <span className="truncate text-ink-mute">{origin}</span>
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
