export const SERVICE_NAME = "우리지금만나";
export const MAX_PARTICIPANTS = 20;
export const POLL_MS = 10_000;
export const SEARCH_DEBOUNCE_MS = 300;
// 도보 환산 속도. 측정값이 아니라 고른 값 (시속 4km).
export const WALK_METERS_PER_MINUTE = 67;

// 백엔드 rooms/service.py의 MAX_MEET_DAYS_AHEAD와 같은 값이다.
export const MAX_MEET_DAYS_AHEAD = 365;

// 이 시간이 지나도 응답이 없으면 무료 서버가 잠들었다 깨는 중이라고 본다.
export const SLOW_MS = 4000;
