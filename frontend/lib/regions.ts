export const REGIONS = ["서울", "경기", "인천"] as const;
export type Region = (typeof REGIONS)[number];

export function parseRegions(values: readonly string[]): Region[] {
  return REGIONS.filter((region) => values.includes(region));
}

export function isAllRegions(values: readonly string[]): boolean {
  return REGIONS.every((region) => values.includes(region));
}

// 마지막 하나는 끄지 않는다. 지역이 하나도 없으면 추천할 곳이 없기 때문.
export function toggleRegion(current: readonly string[], region: Region): Region[] {
  const next = current.includes(region)
    ? parseRegions(current.filter((r) => r !== region))
    : parseRegions([...current, region]);
  return next.length > 0 ? next : parseRegions(current);
}
