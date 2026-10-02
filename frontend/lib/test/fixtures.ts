import type { LegOut, ParticipantOut, RecommendationOut, ResultOut, RoomOut } from "@/lib/api/types";

export const API = "http://localhost:8000";

export function participant(over: Partial<ParticipantOut> = {}): ParticipantOut {
  return { id: 1, nickname: "민수", nearest_station_name: "강남", via: "walk", active: true, ...over };
}

export function room(over: Partial<RoomOut> = {}): RoomOut {
  return {
    slug: "abc123",
    title: "금요일 저녁",
    meet_date: "2026-10-10",
    expires_at: "2026-10-17T00:00:00",
    regions: ["서울", "경기", "인천"],
    theme: null,
    participants: [],
    ...over,
  };
}

export function leg(over: Partial<LegOut> = {}): LegOut {
  return { participant_id: 1, nickname: "민수", minutes: 12, origin_station_name: "강남", via: "walk", ...over };
}

export function rec(over: Partial<RecommendationOut> = {}): RecommendationOut {
  return {
    hub_id: 1,
    name: "양재",
    region: "서울",
    tags: ["교통요지", "카페거리"],
    vibe_summary: "어디서든 오기 쉬운 교통 중심",
    lat: 37.4846,
    lng: 127.0343,
    max_minutes: 22,
    spread_minutes: 10,
    lines: ["3호선", "신분당선"],
    theme_match: false,
    legs: [leg(), leg({ participant_id: 2, nickname: "수진", minutes: 22, origin_station_name: "신림" })],
    ...over,
  };
}

export function result(over: Partial<ResultOut> = {}): ResultOut {
  return {
    status: "ready",
    recommendations: [rec()],
    best_max_minutes: 22,
    regions: ["서울", "경기", "인천"],
    theme: null,
    ...over,
  };
}
