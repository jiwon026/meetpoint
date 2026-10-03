import { WALK_METERS_PER_MINUTE } from "./constants";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const DAY_MS = 86_400_000;

export function aboutMinutes(minutes: number): string {
  return `약 ${minutes}분`;
}

export function walkMinutes(distanceM: number): number {
  return Math.max(1, Math.ceil(distanceM / WALK_METERS_PER_MINUTE));
}

export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatMeetDate(iso: string): string {
  const date = parseIsoDate(iso);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
}

export function dday(iso: string, now: Date = new Date()): string {
  const diff = Math.round((parseIsoDate(iso).getTime() - parseIsoDate(todayIso(now)).getTime()) / DAY_MS);
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}
