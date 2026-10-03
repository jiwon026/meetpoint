// 이 브라우저에서 등록한 participant id만 기억한다. hub_id와 station_id는 재적재 때 바뀌므로 저장하지 않는다.
function key(slug: string): string {
  return `wjm:room:${slug}:mine`;
}

export function readMine(slug: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key(slug)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is number => Number.isInteger(v)) : [];
  } catch {
    // 저장값이 깨졌거나 저장소를 못 쓰는 브라우저. "내가 등록" 표시만 빠진다.
    return [];
  }
}

export function addMine(slug: string, id: number): number[] {
  const next = [...new Set([...readMine(slug), id])];
  try {
    window.localStorage.setItem(key(slug), JSON.stringify(next));
  } catch {
    // 저장 실패는 표시가 빠질 뿐이라 화면을 막지 않는다.
  }
  return next;
}
