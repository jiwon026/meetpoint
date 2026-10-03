import type { LegOut } from "@/lib/api/types";

export type MapOrigin = { id: string; lat: number; lng: number; label: string };

// 지도에 찍을 출발역. 집이 아니라 가장 가까운 역의 좌표다. 좌표가 없는 사람은 뺀다.
export function legOrigins(legs: readonly LegOut[]): MapOrigin[] {
  return legs.flatMap((leg) =>
    leg.origin_lat === null || leg.origin_lng === null
      ? []
      : [
          {
            id: String(leg.participant_id),
            lat: leg.origin_lat,
            lng: leg.origin_lng,
            label: `${leg.origin_station_name} (${leg.nickname})`,
          },
        ],
  );
}
